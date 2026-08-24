
import hashlib
import base64
import re
import random
from cryptography.fernet import Fernet

def decrypt_master_password():
    # Trage hier deinen geheimen Schlüssel ein
    key = b'YOUR_SECRET_KEY'
    # Trage hier dein verschlüsseltes Passwort ein
    encrypted_master = b'YOUR_ENCRYPTED_PASSWORD'
    f = Fernet(key)
    return f.decrypt(encrypted_master).decode()

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

    if not re.search(r'[0-9]', password):
        pos = random.randint(0, len(password) - 1)
        digit = random.choice('0123456789')
        password = password[:pos] + digit + password[pos + 1:]

    if not re.search(r'[A-Z]', password):
        pos = random.randint(0, len(password) - 1)
        password = password[:pos] + random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ') + password[pos + 1:]
    if not re.search(r'[a-z]', password):
        pos = random.randint(0, len(password) - 1)
        password = password[:pos] + random.choice('abcdefghijklmnopqrstuvwxyz') + password[pos + 1:]

    return password

def main():
    serial = input("Seriennummer eingeben: ").strip()
    etp_id = input("ETP Identification (40 Zeichen) eingeben: ").strip()
    master_password = decrypt_master_password()

    password = generate_password(serial, etp_id, master_password, length=16)
    print("\nGeneriertes Passwort:", password)

if __name__ == "__main__":
    main()
