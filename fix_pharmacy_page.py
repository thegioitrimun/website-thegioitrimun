import re

glass_card = "bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0"

filepath = "components/AdminPharmacyManagementPage.tsx"

with open(filepath, "r") as f:
    code = f.read()

# Apply to AnimatedSection
code = code.replace(
    '<AnimatedSection stagger={100}>',
    f'<AnimatedSection stagger={{100}} className="rounded-[1.7rem] {glass_card} p-1">'
)

with open(filepath, "w") as f:
    f.write(code)

print("Fixed pharmacy page main container")
