import re

glass = "bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0"

filepath = "components/AdminPharmacyManagementPage.tsx"

with open(filepath, "r") as f:
    code = f.read()

# Fix search input
code = code.replace(
    'className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"',
    'className="w-full admin-glass-input"'
)

# Fix preview box wrapper
code = code.replace(
    'className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 mb-5"',
    'className="rounded-2xl border border-dashed border-border bg-card/25 backdrop-blur-xl p-4 mb-5"'
)

# Fix preview box inner
code = code.replace(
    'className="aspect-[4/3] rounded-2xl bg-background border border-border overflow-hidden flex items-center justify-center"',
    f'className="aspect-[4/3] rounded-[1.4rem] {glass} overflow-hidden flex items-center justify-center"'
)

# Fix text inputs
code = code.replace(
    'className="w-full p-3 border border-input rounded-xl bg-background"',
    'className="w-full admin-glass-input"'
)
code = code.replace(
    'className="w-full p-3 border border-input rounded-xl bg-background font-mono text-sm"',
    'className="w-full admin-glass-input font-mono text-sm"'
)
code = code.replace(
    'className="w-full min-h-[170px] p-3 border border-input rounded-xl bg-background"',
    'className="w-full admin-glass-input min-h-[170px]"'
)

# Fix Brand card inner (logo container)
code = code.replace(
    'className="w-20 h-20 shrink-0 rounded-xl bg-background overflow-hidden flex items-center justify-center p-2"',
    f'className="w-20 h-20 shrink-0 rounded-[1.1rem] {glass} overflow-hidden flex items-center justify-center p-2"'
)

with open(filepath, "w") as f:
    f.write(code)

print("Fixed brand form styles in AdminPharmacyManagementPage.tsx")
