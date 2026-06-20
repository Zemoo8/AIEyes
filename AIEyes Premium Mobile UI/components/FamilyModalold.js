import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, ScrollView, Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../utils/supabase';

const C = {
  bg:         '#090814',
  primary:    '#786dff',
  primaryDim: 'rgba(120, 109, 255, 0.12)',
  textPri:    '#F4F3FF',
  textSec:    'rgba(214, 210, 255, 0.80)',
  textMuted:  'rgba(151, 145, 203, 0.48)',
  border:     'rgba(120, 109, 255, 0.18)',
  danger:     '#FF3062',
};

const DASHBOARD_BASE = 'https://aieyes-dashboard.vercel.app/invite?code=';

function makeInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'AIEYES-';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function FamilyModal({ visible, onClose, currentUser }) {
  const [invite, setInvite]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError]         = useState('');

  const fetchInvite = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('family_invites')
        .select('*')
        .eq('app_user_id', currentUser.id)
        .is('used_at', null)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setInvite(data ?? null);
    } catch (e) {
      console.log('[Family] fetchInvite error:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (visible) { setError(''); fetchInvite(); }
  }, [visible, fetchInvite]);

  async function handleGenerate() {
    if (!currentUser || generating) return;
    setGenerating(true);
    setError('');
    try {
      const code      = makeInviteCode();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error: insertErr } = await supabase
        .from('family_invites')
        .insert({
          app_user_id: currentUser.id,
          invite_code: code,
          expires_at:  expiresAt,
          used_at:     null,
          used_by:     null,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;
      setInvite(data);
    } catch (e) {
      setError('تعذّر إنشاء رمز الدعوة، حاول مرة أخرى');
      console.log('[Family] generate error:', e?.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke() {
    if (!invite || generating) return;
    setGenerating(true);
    setError('');
    try {
      const { error: updateErr } = await supabase
        .from('family_invites')
        .update({ used_at: new Date().toISOString() })
        .eq('id', invite.id);
      if (updateErr) throw updateErr;
      setInvite(null);
    } catch (e) {
      setError('تعذّر إلغاء الرمز');
      console.log('[Family] revoke error:', e?.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    onClose();
  }

  const qrValue  = invite ? `${DASHBOARD_BASE}${invite.invite_code}` : null;
  const expiry   = invite ? new Date(invite.expires_at).toLocaleDateString('ar-TN') : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={fm.overlay}>
        <View style={fm.sheet}>
          <View style={fm.handle} />

          {/* Header */}
          <View style={fm.header}>
            <Text style={fm.title}>وصول العائلة</Text>
            <Text style={fm.titleSub}>Family Access</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* User row */}
            {currentUser ? (
              <View style={fm.userRow}>
                <Text style={fm.userIcon}>👤</Text>
                <Text style={fm.userEmail} numberOfLines={1}>{currentUser.email}</Text>
              </View>
            ) : null}

            {loading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 32 }} />
            ) : (
              <>
                {invite ? (
                  <View style={fm.inviteCard}>
                    {/* QR */}
                    <View style={fm.qrWrap}>
                      <QRCode
                        value={qrValue}
                        size={160}
                        color={C.primary}
                        backgroundColor="transparent"
                      />
                    </View>

                    {/* Code */}
                    <View style={fm.codeBox}>
                      <Text style={fm.codeLabel}>رمز الدعوة</Text>
                      <Text style={fm.codeValue}>{invite.invite_code}</Text>
                      {expiry && <Text style={fm.codeExpiry}>ينتهي: {expiry}</Text>}
                    </View>

                    {/* Revoke */}
                    <TouchableOpacity
                      style={fm.revokeBtn}
                      onPress={handleRevoke}
                      disabled={generating}
                      activeOpacity={0.8}
                    >
                      {generating
                        ? <ActivityIndicator color={C.danger} size="small" />
                        : <Text style={fm.revokeTxt}>إلغاء الرمز</Text>}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={fm.emptyWrap}>
                    <Text style={fm.emptyTxt}>لا يوجد رمز دعوة نشط</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[fm.generateBtn, generating && fm.generateBtnOff]}
                  onPress={handleGenerate}
                  disabled={generating}
                  activeOpacity={0.82}
                >
                  {generating
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={fm.generateTxt}>إنشاء رمز دعوة جديد</Text>}
                </TouchableOpacity>

                <View style={fm.explainBox}>
                  <Text style={fm.explainTxt}>
                    على ولي الأمر تسجيل الدخول أو إنشاء حساب على لوحة التحكم وقبول الدعوة باستخدام الرمز أو مسح رمز QR.
                  </Text>
                </View>

                {!!error && (
                  <View style={fm.errBox}>
                    <Text style={fm.errTxt}>{error}</Text>
                  </View>
                )}
              </>
            )}

            {/* Logout */}
            <TouchableOpacity style={fm.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
              <Text style={fm.logoutTxt}>تسجيل الخروج</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Close */}
          <TouchableOpacity style={fm.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={fm.closeTxt}>إغلاق</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const fm = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0c0b20',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: 'rgba(120,109,255,0.18)',
    paddingHorizontal: 24, paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 24 : 36,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center', width: 46, height: 4, borderRadius: 999,
    backgroundColor: 'rgba(201,194,255,0.20)', marginBottom: 18,
  },
  header: { alignItems: 'center', marginBottom: 18 },
  title:    { color: C.textPri,   fontSize: 20, fontWeight: '700', letterSpacing: 0.5 },
  titleSub: { color: C.textMuted, fontSize: 11, letterSpacing: 2.5, marginTop: 3 },

  userRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.primaryDim,
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(120,109,255,0.18)',
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20,
  },
  userIcon:  { fontSize: 18, marginRight: 10 },
  userEmail: { color: C.textSec, fontSize: 13, flex: 1 },

  inviteCard: {
    backgroundColor: 'rgba(120,109,255,0.06)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(120,109,255,0.18)',
    padding: 20, alignItems: 'center', marginBottom: 16,
  },
  qrWrap: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(120,109,255,0.14)',
  },
  codeBox:   { alignItems: 'center', marginBottom: 16 },
  codeLabel: { color: C.textMuted, fontSize: 11, letterSpacing: 1.5, marginBottom: 4 },
  codeValue: {
    color: C.primary, fontSize: 18, fontWeight: '800',
    letterSpacing: 3, textAlign: 'center',
  },
  codeExpiry: { color: C.textMuted, fontSize: 11, marginTop: 4, textAlign: 'center' },

  revokeBtn: {
    borderWidth: 1, borderColor: `${C.danger}44`,
    borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9,
    backgroundColor: 'rgba(255,48,98,0.08)',
  },
  revokeTxt: { color: C.danger, fontSize: 13, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingVertical: 24 },
  emptyTxt:  { color: C.textMuted, fontSize: 14, textAlign: 'center' },

  generateBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: C.primary, shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
    marginBottom: 16,
  },
  generateBtnOff: { opacity: 0.6 },
  generateTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  explainBox: {
    backgroundColor: 'rgba(120,109,255,0.06)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(120,109,255,0.14)',
    padding: 14, marginBottom: 14,
  },
  explainTxt: {
    color: C.textMuted, fontSize: 12, lineHeight: 20, textAlign: 'right',
  },

  errBox: {
    backgroundColor: 'rgba(255,48,98,0.10)',
    borderWidth: 1, borderColor: `${C.danger}44`,
    borderRadius: 10, padding: 12, marginBottom: 14,
  },
  errTxt: { color: C.danger, fontSize: 13, textAlign: 'center' },

  logoutBtn: {
    backgroundColor: 'rgba(255,48,98,0.08)',
    borderWidth: 1, borderColor: `${C.danger}33`,
    borderRadius: 14, paddingVertical: 12, alignItems: 'center',
    marginTop: 4, marginBottom: 12,
  },
  logoutTxt: { color: C.danger, fontSize: 14, fontWeight: '600' },

  closeBtn: {
    backgroundColor: 'rgba(120,109,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(120,109,255,0.18)',
    borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  closeTxt: { color: C.textSec, fontSize: 14, fontWeight: '600' },
});
