import re

glass_card = "bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0"

filepath = "components/AdminPharmacyManagementPage.tsx"

with open(filepath, "r") as f:
    code = f.read()

# Fix Brand Form container
code = code.replace(
    '{(isBrandFormVisible || editingBrandId) ? (\n                            <div className="w-full">',
    f'{{(isBrandFormVisible || editingBrandId) ? (\n                            <div className="w-full rounded-[1.7rem] {glass_card} p-6">'
)

# Fix Brand List container
code = code.replace(
    ') : (\n                            <div className="space-y-4">\n                                <div className="bg-transparent rounded-2xl shadow-sm p-4">',
    f') : (\n                            <div className="space-y-4 rounded-[1.7rem] {glass_card} p-6">\n                                <div className="bg-transparent rounded-2xl p-4">'
)
# Note: removed shadow-sm from the header since the wrapper now has the shadow

with open(filepath, "w") as f:
    f.write(code)

print("Fixed brand containers in AdminPharmacyManagementPage.tsx")
