
import json
import hashlib
import base64
import re
import random
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
from cryptography.fernet import Fernet

SETTINGS_FILE = "settings.json"

def load_settings():
    try:
        with open(SETTINGS_FILE, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"fernet_key": "", "encrypted_master": ""}

def save_settings(fernet_key, encrypted_master):
    with open(SETTINGS_FILE, "w") as f:
        json.dump({
            "fernet_key": fernet_key,
            "encrypted_master": encrypted_master
        }, f)

def decrypt_master_password(fernet_key, encrypted_master):
    try:
        f = Fernet(fernet_key.encode())
        return f.decrypt(encrypted_master.encode()).decode()
    except Exception as e:
        messagebox.showerror("Fehler", f"Fehler beim Entschlüsseln des Master-Passworts:\n{str(e)}")
        return ""

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

def create_gui():
    settings = load_settings()

    root = tk.Tk()
    root.title("IoT-DACH PanelServer Password Generator")
    root.geometry("600x400")

    tab_control = ttk.Notebook(root)
    tab_gen = ttk.Frame(tab_control)
    tab_settings = ttk.Frame(tab_control)
    tab_control.add(tab_gen, text='Passwortgenerator')
    tab_control.add(tab_settings, text='Einstellungen')
    tab_control.pack(expand=1, fill="both")

    # Passwortgenerator-Tab
    tk.Label(tab_gen, text="Seriennummer:").pack(pady=5)
    entry_serial = tk.Entry(tab_gen, width=50)
    entry_serial.pack()

    tk.Label(tab_gen, text="ETP Identification (40 Zeichen):").pack(pady=5)
    entry_etp = tk.Entry(tab_gen, width=50)
    entry_etp.pack()

    result_var = tk.StringVar()
    tk.Label(tab_gen, text="Generiertes Passwort:").pack(pady=5)
    entry_result = tk.Entry(tab_gen, textvariable=result_var, width=50, state="readonly")
    entry_result.pack()

    def on_generate():
        serial = entry_serial.get().strip()
        etp_id = entry_etp.get().strip()
        fernet_key = entry_key.get().strip()
        encrypted_master = entry_token.get().strip()
        if not all([serial, etp_id, fernet_key, encrypted_master]):
            messagebox.showerror("Fehler", "Bitte alle Felder ausfüllen und Einstellungen prüfen.")
            return
        master_pw = decrypt_master_password(fernet_key, encrypted_master)
        if master_pw:
            pw = generate_password(serial, etp_id, master_pw)
            result_var.set(pw)
            root.clipboard_clear()
            root.clipboard_append(pw)
            messagebox.showinfo("Erfolg", "Passwort generiert und in Zwischenablage kopiert.")

    tk.Button(tab_gen, text="Passwort generieren", command=on_generate).pack(pady=10)

    # Einstellungs-Tab
    tk.Label(tab_settings, text="Fernet Key:").pack(pady=5)
    entry_key = tk.Entry(tab_settings, width=70)
    entry_key.insert(0, settings.get("fernet_key", ""))
    entry_key.pack()

    tk.Label(tab_settings, text="Verschlüsseltes Master-Passwort:").pack(pady=5)
    entry_token = tk.Entry(tab_settings, width=70)
    entry_token.insert(0, settings.get("encrypted_master", ""))
    entry_token.pack()

    def generate_key():
        new_key = Fernet.generate_key().decode()
        entry_key.delete(0, tk.END)
        entry_key.insert(0, new_key)
        messagebox.showinfo("Key generiert", "Neuer Fernet-Key wurde erzeugt.")

    def encrypt_master():
        key = entry_key.get().strip()
        pw = simpledialog.askstring("Master-Passwort", "Master-Passwort eingeben:", show='*')
        if key and pw:
            try:
                f = Fernet(key.encode())
                token = f.encrypt(pw.encode()).decode()
                entry_token.delete(0, tk.END)
                entry_token.insert(0, token)
            except Exception as e:
                messagebox.showerror("Fehler", str(e))
        else:
            messagebox.showwarning("Fehlt", "Bitte zuerst Key erzeugen und Passwort eingeben.")

    def save_config():
        save_settings(entry_key.get().strip(), entry_token.get().strip())
        messagebox.showinfo("Gespeichert", "Einstellungen wurden gespeichert.")

    tk.Button(tab_settings, text="Neuen Key generieren", command=generate_key).pack(pady=5)
    tk.Button(tab_settings, text="Master-Passwort verschlüsseln", command=encrypt_master).pack(pady=5)
    tk.Button(tab_settings, text="Einstellungen speichern", command=save_config).pack(pady=10)

    root.mainloop()

create_gui()
