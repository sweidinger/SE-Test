"""Erzeugt Referenzvektoren mit der EXAKTEN Funktion aus dem Originaltool."""
import base64
import hashlib
import json
import random
import re
import secrets
import string
import sys

# --- woertlich aus src/passwort_generator_gui_mit_settings.py ---------------
def generate_password(serial, etp_id, master_password, length=16):
    special_chars = "!@#$%^&*()"
    combined = f"{serial}:{etp_id}:{master_password}"
    hash_obj = hashlib.sha256(combined.encode())
    hash_bytes = hash_obj.digest()
    b64_password = base64.urlsafe_b64encode(hash_bytes).decode('utf-8')

    seed = int.from_bytes(hash_bytes, 'big')
    random.seed(seed)

    password = (b64_password * ((length // len(b64_password)) + 1))[:length]

    num_specials = max(2, length // 8)
    for _ in range(num_specials):
        pos = random.randint(0, len(password) - 1)
        char = random.choice(special_chars)
        password = password[:pos] + char + password[pos + 1:]

    branches = []
    if not re.search(r'[0-9]', password):
        branches.append('digit')
        pos = random.randint(0, len(password) - 1)
        digit = random.choice('0123456789')
        password = password[:pos] + digit + password[pos + 1:]

    if not re.search(r'[A-Z]', password):
        branches.append('upper')
        pos = random.randint(0, len(password) - 1)
        password = password[:pos] + random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ') + password[pos + 1:]
    if not re.search(r'[a-z]', password):
        branches.append('lower')
        pos = random.randint(0, len(password) - 1)
        password = password[:pos] + random.choice('abcdefghijklmnopqrstuvwxyz') + password[pos + 1:]

    return password, branches
# ---------------------------------------------------------------------------


def rand_str(n):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(n))


def main(count):
    vectors = []
    # Realistische Faelle plus Sonderfaelle (leer, Unicode, sehr lang)
    fixed = [
        ("", "", ""),
        ("TEST123", "abc", "demo"),
        ("SN-0001", "A" * 40, "03_Schneider_IOT!"),
        ("Ümläut", "ETP-Ü-40", "pässwörd"),
        ("x" * 200, "y" * 200, "z" * 200),
    ]
    for serial, etp, master in fixed:
        pw, br = generate_password(serial, etp, master)
        vectors.append(dict(serial=serial, etp=etp, master=master, length=16,
                            expected=pw, branches=br))

    for _ in range(count):
        serial = rand_str(secrets.randbelow(20) + 1)
        etp = rand_str(40)
        master = rand_str(secrets.randbelow(24) + 1)
        length = secrets.choice([8, 12, 16, 20, 32])
        pw, br = generate_password(serial, etp, master, length)
        vectors.append(dict(serial=serial, etp=etp, master=master, length=length,
                            expected=pw, branches=br))

    json.dump(vectors, open(sys.argv[2], 'w'))
    cov = {}
    for v in vectors:
        for b in v['branches']:
            cov[b] = cov.get(b, 0) + 1
    print(f"  {len(vectors)} Vektoren erzeugt (Python {sys.version.split()[0]})")
    print(f"  Fallback-Zweige abgedeckt: {cov or 'keine ausgeloest'}")


if __name__ == "__main__":
    main(int(sys.argv[1]))
