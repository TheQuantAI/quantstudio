#!/usr/bin/env python3
"""
D8 — End-to-end test: signup → API key → submit circuit → get result.

Tests the full TheQuantCloud lifecycle against the live production API.
Uses Supabase Auth email signup + TheQuantCloud API.

Usage:
    python scripts/test_e2e_cloud.py

Requirements:
    pip install httpx  (or just use the quantcloud-api .venv)
"""

import json
import os
import sys
import time
import uuid
import httpx

# ─── Configuration ───────────────────────────────────────────────

CLOUD_API = os.getenv("CLOUD_API_URL", "https://api.thequantcloud.com")
SUPABASE_URL = os.getenv(
    "SUPABASE_URL", "https://ccqacsutdpetwjuprhfu.supabase.co"
)
SUPABASE_ANON_KEY = os.getenv(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjcWFjc3V0ZHBldHdqdXByaGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODE2NjEsImV4cCI6MjA4OTE1NzY2MX0.JTx-0s1AMj4gUFRcOhLCjnRSgHI3jSjwR54cvMs8RzM",
)

# Generate a unique test email for each run
TEST_RUN_ID = uuid.uuid4().hex[:8]
TEST_EMAIL = f"e2e-{TEST_RUN_ID}@test.thequantcloud.com"
TEST_PASSWORD = f"TestPass_{TEST_RUN_ID}!Aa1"

client = httpx.Client(timeout=30)

passed = 0
failed = 0
total = 0


def test(name: str, fn):
    global passed, failed, total
    total += 1
    try:
        fn()
        passed += 1
        print(f"  ✅ {total}. {name}")
    except Exception as e:
        failed += 1
        print(f"  ❌ {total}. {name}: {e}")


# ─── Step 1: Health check ────────────────────────────────────────

def test_health():
    r = client.get(f"{CLOUD_API}/health")
    assert r.status_code == 200, f"HTTP {r.status_code}"
    data = r.json()
    assert data["status"] == "ok"


# ─── Step 2: Signup via Supabase Auth ────────────────────────────

access_token = None


def test_signup():
    global access_token
    r = client.post(
        f"{SUPABASE_URL}/auth/v1/signup",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "data": {"full_name": "E2E Test User"},
        },
    )
    assert r.status_code in (200, 201), f"Signup failed: {r.status_code} {r.text}"
    data = r.json()
    # Supabase may auto-confirm or return a session
    if "access_token" in data:
        access_token = data["access_token"]
    elif "session" in data and data["session"]:
        access_token = data["session"]["access_token"]
    else:
        # Email confirmation required — try to login directly
        # (Supabase free tier may auto-confirm depending on settings)
        pass
    assert access_token, "No access token received from signup"


# ─── Step 3: Login (if needed) ───────────────────────────────────

def test_login():
    global access_token
    if access_token:
        return  # Already have token from signup
    r = client.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    access_token = data["access_token"]
    assert access_token


# ─── Step 4: Generate API key ────────────────────────────────────

api_key = None


def test_create_api_key():
    global api_key
    r = client.post(
        f"{CLOUD_API}/v1/auth/api-keys",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"name": "e2e-test-key"},
    )
    assert r.status_code == 201, f"Create key failed: {r.status_code} {r.text}"
    data = r.json()
    api_key = data["key"]
    assert api_key.startswith("qc_"), f"Key format unexpected: {api_key[:10]}..."


# ─── Step 5: List API keys ──────────────────────────────────────

def test_list_api_keys():
    r = client.get(
        f"{CLOUD_API}/v1/auth/api-keys",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert r.status_code == 200
    keys = r.json()
    assert len(keys) >= 1, "Expected at least 1 API key"
    assert any(k["name"] == "e2e-test-key" for k in keys)


# ─── Step 6: Submit circuit via JWT ──────────────────────────────

job_id = None

BELL_STATE_CODE = """
import quantsdk as qs
circuit = qs.Circuit(2, name="bell")
circuit.h(0)
circuit.cx(0, 1)
circuit.measure_all()
result = qs.run(circuit, shots=100)
"""


def test_submit_circuit_jwt():
    global job_id
    r = client.post(
        f"{CLOUD_API}/v1/circuits/run",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={
            "code": BELL_STATE_CODE,
            "shots": 100,
            "optimize_for": "speed",
            "num_qubits": 2,
        },
    )
    assert r.status_code == 202, f"Submit failed: {r.status_code} {r.text}"
    data = r.json()
    job_id = data["job_id"]
    assert data["status"] == "submitted"


# ─── Step 7: Poll job until complete ─────────────────────────────

def test_poll_job():
    global job_id
    for _attempt in range(30):
        r = client.get(
            f"{CLOUD_API}/v1/jobs/{job_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert r.status_code == 200
        data = r.json()
        if data["status"] in ("completed", "failed", "timeout"):
            assert data["status"] == "completed", f"Job ended with status: {data['status']} — {data.get('error_message')}"
            return
        time.sleep(1)
    raise TimeoutError("Job did not complete within 30s")


# ─── Step 8: Get job result ──────────────────────────────────────

def test_get_result():
    r = client.get(
        f"{CLOUD_API}/v1/jobs/{job_id}/result",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert r.status_code == 200, f"Get result failed: {r.status_code}"
    data = r.json()
    assert "counts" in data, "Missing counts in result"
    counts = data["counts"]
    total_shots = sum(counts.values())
    assert total_shots > 0, "No shots in result"
    print(f"       Result: {json.dumps(counts)} ({total_shots} shots)")


# ─── Step 9: Submit circuit via API key ──────────────────────────

job_id_2 = None


def test_submit_circuit_apikey():
    global job_id_2
    r = client.post(
        f"{CLOUD_API}/v1/circuits/run",
        headers={
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        },
        json={
            "code": BELL_STATE_CODE,
            "shots": 50,
            "num_qubits": 2,
        },
    )
    assert r.status_code == 202, f"Submit via API key failed: {r.status_code} {r.text}"
    data = r.json()
    job_id_2 = data["job_id"]
    assert data["status"] == "submitted"


# ─── Step 10: Poll API-key job ───────────────────────────────────

def test_poll_apikey_job():
    for _attempt in range(30):
        r = client.get(
            f"{CLOUD_API}/v1/jobs/{job_id_2}",
            headers={"X-API-Key": api_key},
        )
        assert r.status_code == 200
        data = r.json()
        if data["status"] in ("completed", "failed", "timeout"):
            assert data["status"] == "completed", f"API-key job: {data['status']}"
            return
        time.sleep(1)
    raise TimeoutError("API-key job did not complete within 30s")


# ─── Step 11: Check usage ────────────────────────────────────────

def test_usage():
    r = client.get(
        f"{CLOUD_API}/v1/account/usage",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["tier"] == "explorer"
    assert data["credits_remaining_usd"] > 0
    print(f"       Tier: {data['tier']}, Credits: ${data['credits_remaining_usd']:.2f}")


# ─── Step 12: Save a circuit ────────────────────────────────────

circuit_id = None


def test_save_circuit():
    global circuit_id
    r = client.post(
        f"{CLOUD_API}/v1/circuits",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={"name": "E2E Bell State", "code": BELL_STATE_CODE},
    )
    assert r.status_code == 201, f"Save circuit failed: {r.status_code}"
    data = r.json()
    circuit_id = data["id"]
    assert data["name"] == "E2E Bell State"


# ─── Step 13: List circuits ─────────────────────────────────────

def test_list_circuits():
    r = client.get(
        f"{CLOUD_API}/v1/circuits",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert r.status_code == 200
    circuits = r.json()
    assert any(c["id"] == circuit_id for c in circuits)


# ─── Step 14: Revoke API key ────────────────────────────────────

def test_revoke_key():
    # Get key ID
    r = client.get(
        f"{CLOUD_API}/v1/auth/api-keys",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    keys = r.json()
    key_id = next(k["id"] for k in keys if k["name"] == "e2e-test-key")
    r = client.delete(
        f"{CLOUD_API}/v1/auth/api-keys/{key_id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert r.status_code in (200, 204), f"Revoke failed: {r.status_code}"


# ─── Run all tests ───────────────────────────────────────────────

if __name__ == "__main__":
    print(f"\n🧪 TheQuantCloud E2E Test — {CLOUD_API}")
    print(f"   Test user: {TEST_EMAIL}\n")

    test("Health check", test_health)
    test("Signup via Supabase Auth", test_signup)
    test("Login (if needed)", test_login)
    test("Create API key", test_create_api_key)
    test("List API keys", test_list_api_keys)
    test("Submit circuit (JWT auth)", test_submit_circuit_jwt)
    test("Poll job until complete", test_poll_job)
    test("Get job result", test_get_result)
    test("Submit circuit (API key auth)", test_submit_circuit_apikey)
    test("Poll API-key job", test_poll_apikey_job)
    test("Check usage/quota", test_usage)
    test("Save circuit to cloud", test_save_circuit)
    test("List saved circuits", test_list_circuits)
    test("Revoke API key", test_revoke_key)

    print(f"\n{'='*50}")
    print(f"  Results: {passed}/{total} passed, {failed} failed")
    print(f"{'='*50}\n")

    sys.exit(0 if failed == 0 else 1)
