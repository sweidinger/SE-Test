
from cryptography.fernet import Fernet

# 1. Schlüssel generieren (nur einmal!)
key = Fernet.generate_key()
print("🔑 Fernet-Schlüssel (bitte sicher speichern):")
print(key)

# 2. Passwort eingeben
master_pw = input("🔐 Master-Passwort eingeben: ").encode()

# 3. Passwort verschlüsseln
f = Fernet(key)
token = f.encrypt(master_pw)

print("\n📦 Verschlüsseltes Passwort (für das Script):")
print(token)
