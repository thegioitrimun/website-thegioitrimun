import re

glass_card = "bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0"

filepath = "components/AdminPharmacyManagementPage.tsx"

with open(filepath, "r") as f:
    code = f.read()

# Fix empty state
code = code.replace(
    'className="bg-card rounded-3xl border border-border shadow-md p-12 text-center"',
    f'className="rounded-[1.7rem] {glass_card} p-12 text-center"'
)

# Fix brand cards
code = code.replace(
    "border-0 bg-background/30 backdrop-blur-xl hover:-translate-y-0.5 hover:bg-background/50",
    f"{glass_card} hover:-translate-y-0.5 hover:bg-card/40"
)

with open(filepath, "w") as f:
    f.write(code)

print("Fixed brand cards in AdminPharmacyManagementPage.tsx")
