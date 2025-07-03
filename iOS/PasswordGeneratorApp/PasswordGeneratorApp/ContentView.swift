import SwiftUI
import CryptoKit
import Foundation

struct ContentView: View {
    @State private var serialNumber = ""
    @State private var etpId = ""
    @State private var masterPassword = ""
    @State private var generatedPassword = ""
    @State private var showingAlert = false
    @State private var alertMessage = ""
    
    var body: some View {
        NavigationView {
            Form {
                Section("Input") {
                    TextField("Serial Number", text: $serialNumber)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                    
                    TextField("ETP ID (40 characters)", text: $etpId)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                    
                    SecureField("Master Password", text: $masterPassword)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                }
                
                Section("Generated Password") {
                    HStack {
                        Text(generatedPassword)
                            .textSelection(.enabled)
                            .foregroundColor(.primary)
                        
                        Spacer()
                        
                        if !generatedPassword.isEmpty {
                            Button("Copy") {
                                UIPasteboard.general.string = generatedPassword
                                alertMessage = "Password copied to clipboard!"
                                showingAlert = true
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                }
                
                Section {
                    Button("Generate Password") {
                        generatePassword()
                    }
                    .frame(maxWidth: .infinity)
                    .disabled(serialNumber.isEmpty || etpId.isEmpty || masterPassword.isEmpty)
                }
            }
            .navigationTitle("IoT-DACH PanelServer")
            .navigationBarTitleDisplayMode(.large)
        }
        .alert("Success", isPresented: $showingAlert) {
            Button("OK") { }
        } message: {
            Text(alertMessage)
        }
    }
    
    func generatePassword() {
        let combined = "\(serialNumber):\(etpId):\(masterPassword)"
        let inputData = Data(combined.utf8)
        let hashed = SHA256.hash(data: inputData)
        let hashData = Data(hashed)
        
        // Convert to base64 URL-safe
        let base64Password = hashData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
        
        // Generate deterministic password with special characters
        var password = String(base64Password.prefix(16))
        
        // Use hash bytes as seed for deterministic randomness
        let seed = hashData.reduce(0) { result, byte in
            return result ^ UInt64(byte)
        }
        
        var generator = SeededRandomGenerator(seed: seed)
        
        // Add special characters
        let specialChars = "!@#$%^&*()"
        let numSpecials = max(2, password.count / 8)
        
        var passwordArray = Array(password)
        
        for _ in 0..<numSpecials {
            let pos = Int(generator.next()) % passwordArray.count
            let char = specialChars[specialChars.index(specialChars.startIndex, 
                                                     offsetBy: Int(generator.next()) % specialChars.count)]
            passwordArray[pos] = char
        }
        
        // Ensure we have at least one digit
        if !passwordArray.contains(where: { $0.isNumber }) {
            let pos = Int(generator.next()) % passwordArray.count
            let digit = Character("\(Int(generator.next()) % 10)")
            passwordArray[pos] = digit
        }
        
        // Ensure we have at least one uppercase
        if !passwordArray.contains(where: { $0.isUppercase }) {
            let pos = Int(generator.next()) % passwordArray.count
            let letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            let char = letters[letters.index(letters.startIndex, 
                                           offsetBy: Int(generator.next()) % letters.count)]
            passwordArray[pos] = char
        }
        
        // Ensure we have at least one lowercase
        if !passwordArray.contains(where: { $0.isLowercase }) {
            let pos = Int(generator.next()) % passwordArray.count
            let letters = "abcdefghijklmnopqrstuvwxyz"
            let char = letters[letters.index(letters.startIndex, 
                                           offsetBy: Int(generator.next()) % letters.count)]
            passwordArray[pos] = char
        }
        
        generatedPassword = String(passwordArray)
        
        // Auto-copy to clipboard
        UIPasteboard.general.string = generatedPassword
        alertMessage = "Password generated and copied to clipboard!"
        showingAlert = true
    }
}

// Deterministic random number generator for consistent results
struct SeededRandomGenerator {
    private var state: UInt64
    
    init(seed: UInt64) {
        self.state = seed
    }
    
    mutating func next() -> UInt64 {
        state = state &* 1103515245 &+ 12345
        return state
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
