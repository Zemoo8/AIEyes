/**
 * AIEyes — components/FamilyModal.js  (refined)
 *
 * DROP-IN REPLACEMENT for the existing FamilyModal.
 * Public API unchanged: <FamilyModal visible onClose currentUser/>.
 * All Supabase logic preserved.
 *
 * Design changes per brief:
 *   • QR is the focal point — large, centered, white card, generous halo.
 *   • Access code presented as big mono text below the QR (was small/secondary).
 *   • Validity is a calm chip, not a buried gray line.
 *   • One primary action: Open Dashboard. Secondary: New Code · Revoke All.
 *   • Logout is a quiet bottom link, not a heavy red button.
 *   • Empty state stays simple — single Generate CTA.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Linking, Platform, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../utils/supabase';

const C = {
  bg:        '#0a0820',
  bgSheet:   '#0d0a24',
  primary:   '#786dff',
  primaryHi: '#b29bff',
  textPri:   '#F4F3FF',
  textSec:   'rgba(220,210,255,0.72)',
  textMuted: 'rgba(180,170,220,0.5)',
  border:    'rgba(180,160,255,0.18)',
  danger:    '#FF3062',
  success:   '#22d9a0',
};

const DASHBOARD_BASE = 'https://aieyes-dashboard.vercel.app/invite?code=';

function makeInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'AIEYES-';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function formatCode(raw = '') {
  // "AIEYES-78H24LXX" → "78H · 24L · XX"
  const body = raw.replace(/^AIEYES-/i, '');
  return body.match(/.{1,3}/g)?.join(' · ') ?? body;
}

function timeRemaining(expiresAt) {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `valid · ${days}d ${hours}h`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `valid · ${hours}h ${mins}m` : `valid · ${mins}m`;
}

export default function FamilyModal({ visible, onClose, currentUser }) {
  const [invite, setInvite]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState('');

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
    if (!currentUser || busy) return;
    setBusy(true); setError('');
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
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!invite || busy) return;
    setBusy(true); setError('');
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
      setBusy(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    onClose();
  }

  async function handleOpenDashboard() {
    if (!invite) return;
    try { await Linking.openURL(`${DASHBOARD_BASE}${invite.invite_code}`); }
    catch (e) { console.log('[Family] open dashboard error:', e?.message); }
  }

  async function handleShare() {
    if (!invite) return;
    try {
      await Share.share({
        message:
          `انضمّ إلى عائلتي على AIEyes:\n` +
          `${DASHBOARD_BASE}${invite.invite_code}\n` +
          `الرمز: ${invite.invite_code}`,
      });
    } catch (e) { console.log('[Family] share error:', e?.message); }
  }

  const qrValue = invite ? `${DASHBOARD_BASE}${invite.invite_code}` : null;
  const validity = useMemo(() => timeRemaining(invite?.expires_at), [invite?.expires_at]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={st.overlay}>
        {/* dimmer */}
        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onClose}/>

        <View style={st.sheet}>
          {/* atmospheric halo behind sheet */}
          <LinearGradient
            colors={['rgba(120,90,220,0.12)', 'rgba(120,90,220,0)']}
            style={st.sheetGlow}
            pointerEvents="none"
          />

          {/* handle */}
          <View style={st.handle}/>

          {/* top bar */}
          <View style={st.topBar}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.75} style={st.iconBtn}>
              <Text style={{ color: C.textSec, fontSize: 16, fontWeight: '600' }}>×</Text>
            </TouchableOpacity>
            <Text style={st.topTitle}>FAMILY</Text>
            <View style={{ width: 32 }}/>
          </View>

          {/* header */}
          <View style={st.header}>
            <Text style={st.titleAr}>دعوة العائلة</Text>
            <Text style={st.titleEn}>Invite family</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={C.primary} style={{ marginVertical: 40 }}/>
          ) : invite ? (
            <>
              {/* QR — the hero */}
              <View style={st.qrWrap}>
                <View style={st.qrHaloOuter}/>
                <View style={st.qrCard}>
                  <QRCode
                    value={qrValue}
                    size={188}
                    color="#0a0816"
                    backgroundColor="#f4eeff"
                  />
                </View>
              </View>

              {/* Code — big mono, breathing */}
              <View style={{ alignItems: 'center', marginTop: 22 }}>
                <Text style={st.code}>{formatCode(invite.invite_code)}</Text>
                <View style={st.validityChip}>
                  <View style={st.validityDot}/>
                  <Text style={st.validityTxt}>{validity}</Text>
                </View>
              </View>

              {/* Primary action */}
              <View style={{ paddingHorizontal: 24, marginTop: 26 }}>
                <TouchableOpacity onPress={handleShare} activeOpacity={0.88} style={st.primaryBtnWrap}>
                  <LinearGradient
                    colors={['#9c8bff', '#7a6dff', '#5e51d6']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={st.primaryBtn}
                  >
                    <Text style={st.primaryBtnTxt}>Share invite</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Ghost: open dashboard */}
                <TouchableOpacity onPress={handleOpenDashboard} activeOpacity={0.75} style={st.ghostBtn}>
                  <Text style={st.ghostBtnTxt}>Open dashboard</Text>
                </TouchableOpacity>

                {/* Secondary actions row */}
                <View style={st.actionRow}>
                  <TouchableOpacity onPress={handleGenerate} disabled={busy} activeOpacity={0.7} style={{ paddingVertical: 10, paddingHorizontal: 8 }}>
                    {busy ? <ActivityIndicator color={C.textSec} size="small"/> :
                      <Text style={st.linkTxt}>New code</Text>}
                  </TouchableOpacity>
                  <View style={st.dot}/>
                  <TouchableOpacity onPress={handleRevoke} disabled={busy} activeOpacity={0.7} style={{ paddingVertical: 10, paddingHorizontal: 8 }}>
                    <Text style={st.linkDangerTxt}>Revoke all</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            // Empty state — no active invite
            <View style={st.emptyWrap}>
              <Text style={st.emptyTxt}>لا يوجد رمز نشط حالياً</Text>
              <Text style={st.emptySub}>No active invite. Create one to link a family member.</Text>
              <View style={{ marginTop: 20, paddingHorizontal: 24, width: '100%' }}>
                <TouchableOpacity onPress={handleGenerate} disabled={busy} activeOpacity={0.88} style={st.primaryBtnWrap}>
                  <LinearGradient
                    colors={['#9c8bff', '#7a6dff', '#5e51d6']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={st.primaryBtn}
                  >
                    {busy
                      ? <ActivityIndicator color="rgba(255,255,255,0.92)" size="small"/>
                      : <Text style={st.primaryBtnTxt}>Generate invite</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!!error && (
            <View style={st.errBox}>
              <Text style={st.errTxt}>{error}</Text>
            </View>
          )}

          {/* footer: account + quiet logout */}
          <View style={st.footer}>
            {!!currentUser && (
              <Text style={st.footerEmail} numberOfLines={1}>
                {currentUser.email}
              </Text>
            )}
            <TouchableOpacity onPress={handleLogout} activeOpacity={0.7} style={{ paddingVertical: 8 }}>
              <Text style={st.logoutTxt}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bgSheet,
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    borderWidth: 1, borderColor: C.border,
    paddingBottom: Platform.OS === 'android' ? 22 : 34,
    paddingTop: 10,
    maxHeight: '94%',
    overflow: 'hidden',
  },
  sheetGlow: {
    position: 'absolute',
    left: -40, right: -40, top: -120, height: 320,
    borderBottomLeftRadius: 999, borderBottomRightRadius: 999,
  },

  handle: {
    alignSelf: 'center', width: 42, height: 4, borderRadius: 999,
    backgroundColor: 'rgba(201,194,255,0.22)',
  },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4,
  },
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(180,150,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  topTitle: {
    color: 'rgba(220,210,255,0.55)',
    fontSize: 11, fontWeight: '700', letterSpacing: 2.4,
  },

  header: {
    paddingHorizontal: 24, paddingTop: 14, alignItems: 'center',
  },
  titleAr: {
    color: C.textSec, fontSize: 13, fontWeight: '500',
    writingDirection: 'rtl',
  },
  titleEn: {
    color: C.textPri, fontSize: 26, fontWeight: '700',
    letterSpacing: -0.4, marginTop: 4,
  },

  // QR hero
  qrWrap: {
    alignItems: 'center', justifyContent: 'center',
    marginTop: 28, height: 240,
  },
  qrHaloOuter: {
    position: 'absolute',
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(120,90,220,0.18)',
    opacity: 0.7,
  },
  qrCard: {
    padding: 14, borderRadius: 24,
    backgroundColor: '#f4eeff',
    shadowColor: '#786dff', shadowOpacity: 0.45, shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 }, elevation: 18,
  },

  // Code
  code: {
    color: C.textPri, fontSize: 28, fontWeight: '600',
    letterSpacing: 6,
    textShadowColor: 'rgba(180,150,255,0.4)', textShadowRadius: 20,
  },
  validityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(34,217,160,0.08)',
    borderWidth: 1, borderColor: 'rgba(34,217,160,0.32)',
  },
  validityDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: C.success,
  },
  validityTxt: {
    color: C.success, fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
  },

  // Buttons
  primaryBtnWrap: {
    borderRadius: 18,
    shadowColor: C.primary, shadowOpacity: 0.5, shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  primaryBtn: {
    height: 52, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnTxt: {
    color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.4,
  },
  ghostBtn: {
    marginTop: 10,
    height: 50, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: 'rgba(180,150,255,0.22)',
  },
  ghostBtnTxt: {
    color: 'rgba(220,210,255,0.85)',
    fontSize: 14, fontWeight: '600',
  },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, marginTop: 14,
  },
  dot: {
    width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(180,150,255,0.4)',
  },
  linkTxt: {
    color: C.primaryHi, fontSize: 12.5, fontWeight: '700',
    letterSpacing: 0.6,
  },
  linkDangerTxt: {
    color: 'rgba(255,138,160,0.85)', fontSize: 12.5, fontWeight: '700',
    letterSpacing: 0.6,
  },

  // empty state
  emptyWrap: { alignItems: 'center', paddingTop: 40, paddingBottom: 12 },
  emptyTxt: {
    color: C.textPri, fontSize: 16, fontWeight: '600',
    writingDirection: 'rtl',
  },
  emptySub: {
    color: C.textMuted, fontSize: 12.5, marginTop: 6, paddingHorizontal: 32,
    textAlign: 'center', lineHeight: 18,
  },

  errBox: {
    marginTop: 14, marginHorizontal: 24,
    padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,48,98,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,48,98,0.32)',
  },
  errTxt: { color: C.danger, fontSize: 13, textAlign: 'center' },

  // footer
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 18, paddingHorizontal: 24, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(180,150,255,0.1)',
  },
  footerEmail: {
    color: C.textMuted, fontSize: 11.5, flex: 1, marginRight: 14,
  },
  logoutTxt: {
    color: 'rgba(255,138,160,0.78)', fontSize: 12, fontWeight: '700',
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
});
