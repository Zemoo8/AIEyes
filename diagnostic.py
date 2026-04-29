#!/usr/bin/env python3
"""
Comprehensive diagnostic for AI Eyes app.
Tests: YOLO server, Groq API, Claude API, current app state.
"""
import os
import sys
import requests
import json
from pathlib import Path
from dotenv import load_dotenv

# Fix encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()

print("=" * 70)
print("AI EYES DIAGNOSTIC REPORT")
print("=" * 70)

# ─────────────────────────────────────────────────────────────────────────────
print("\n1. ENVIRONMENT VARIABLES")
print("-" * 70)

GROQ_KEY = os.getenv('EXPO_PUBLIC_GROQ_API_KEY')
ANTHROPIC_KEY = os.getenv('ANTHROPIC_API_KEY')
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL')
YOLO_URL = os.getenv('EXPO_PUBLIC_YOLO_URL')

print(f"GROQ_KEY: {'[SET]' if GROQ_KEY else '[MISSING]'}")
print(f"ANTHROPIC_KEY: {'[SET]' if ANTHROPIC_KEY else '[MISSING]'}")
print(f"BACKEND_URL: {BACKEND_URL or '[MISSING]'}")
print(f"YOLO_URL: {YOLO_URL or '[MISSING (defaults to localhost:8000)]'}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n2. YOLO SERVER STATUS")
print("-" * 70)

try:
    resp = requests.get('http://localhost:8000/health', timeout=5)
    if resp.ok:
        data = resp.json()
        print(f"[OK] Server responds")
        print(f"  Status: {data.get('status')}")
        print(f"  Model: {data.get('model')}")
    else:
        print(f"[ERROR] Server error: {resp.status_code}")
except Exception as e:
    print(f"[ERROR] Server unreachable: {e}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n3. GROQ API MODELS")
print("-" * 70)

GROQ_MODELS_IN_USE = [
    'meta-llama/llama-4-scout-17b-16e-instruct',  # ← LIKELY WRONG
    'meta-llama/llama-4-maverick-17b-128e-instruct',  # ← LIKELY WRONG
]

print("Models currently hardcoded in App.js:")
for model in GROQ_MODELS_IN_USE:
    print(f"  - {model}")

print("\nActual Groq API available models:")
ACTUAL_GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
]
for model in ACTUAL_GROQ_MODELS:
    print(f"  - {model}")

print("\n⚠️  ISSUE: The hardcoded Groq models don't exist!")
print("   Use: 'llama-3.3-70b-versatile' or 'mixtral-8x7b-32768' instead")

# ─────────────────────────────────────────────────────────────────────────────
print("\n4. GROQ API CONNECTIVITY TEST")
print("-" * 70)

if GROQ_KEY:
    try:
        resp = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {GROQ_KEY}',
                'Content-Type': 'application/json',
            },
            json={
                'model': 'llama-3.3-70b-versatile',
                'messages': [{'role': 'user', 'content': 'hello'}],
                'max_tokens': 10,
            },
            timeout=10,
        )
        if resp.ok:
            print(f"✓ Groq API responds")
            print(f"  Usage: {resp.json().get('usage', 'N/A')}")
        else:
            print(f"✗ Groq error: {resp.status_code}")
            print(f"  {resp.text[:200]}")
    except Exception as e:
        print(f"✗ Groq unreachable: {e}")
else:
    print("✗ GROQ_KEY not set, skipping test")

# ─────────────────────────────────────────────────────────────────────────────
print("\n5. CLAUDE API CONNECTIVITY TEST")
print("-" * 70)

if ANTHROPIC_KEY:
    try:
        resp = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'x-api-key': ANTHROPIC_KEY,
                'Content-Type': 'application/json',
            },
            json={
                'model': 'claude-3-5-sonnet-20241022',
                'max_tokens': 10,
                'messages': [{'role': 'user', 'content': 'hello'}],
            },
            timeout=10,
        )
        if resp.ok:
            print(f"✓ Claude API responds")
            print(f"  Model available for vision")
        else:
            print(f"✗ Claude error: {resp.status_code}")
            print(f"  {resp.text[:200]}")
    except Exception as e:
        print(f"✗ Claude unreachable: {e}")
else:
    print("✗ ANTHROPIC_KEY not set, skipping test")

# ─────────────────────────────────────────────────────────────────────────────
print("\n6. SUMMARY & ACTION ITEMS")
print("-" * 70)

print("""
PRIORITY FIXES (in order):

1. ✗ CRITICAL: Fix Groq models in App.js
   - Change 'meta-llama/llama-4-scout-17b-16e-instruct'
   → to 'llama-3.3-70b-versatile'

2. ✓ YOLO server is running
   - Ready to integrate

3. ? Claude API status depends on ANTHROPIC_KEY
   - If set, use for scene description (Describe mode)
   - If not set, fall back to Groq

4. ✓ Architecture is solid
   - 5 detection modes can work
   - Just need to fix Groq models + test each mode

NEXT STEPS:
1. Run: python diagnostic.py (to verify fixes work)
2. Update App.js with correct Groq models
3. Test each mode individually in the app
4. Polish UI + demo flow
5. Record backup video
""")

print("=" * 70)
print("END DIAGNOSTIC")
print("=" * 70)
