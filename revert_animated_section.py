filepath = "components/AdminPharmacyManagementPage.tsx"

with open(filepath, "r") as f:
    code = f.read()

# Revert AnimatedSection
glass_class = 'className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-1"'
code = code.replace(f'<AnimatedSection stagger={{100}} {glass_class}>', '<AnimatedSection stagger={100}>')

with open(filepath, "w") as f:
    f.write(code)

print("Reverted AnimatedSection")
