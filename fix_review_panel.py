import re

glass = "bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0"

filepath = "components/ProductContentReviewPanel.tsx"

with open(filepath, "r") as f:
    code = f.read()

code = code.replace('className="mt-4 rounded-[1.2rem] border border-border bg-background px-4 py-4"', f'className="mt-4 rounded-[1.2rem] {glass} px-4 py-4"')
code = code.replace('className="rounded-[1.1rem] border border-border bg-background px-4 py-3"', f'className="rounded-[1.1rem] {glass} px-4 py-3"')

with open(filepath, "w") as f:
    f.write(code)

print("Fixed ProductContentReviewPanel.tsx")
