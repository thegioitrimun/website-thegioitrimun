import os
import re
import glob

files = glob.glob("components/Product*.tsx")
glass_container = "rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0"

for filepath in files:
    with open(filepath, "r") as f:
        code = f.read()
    
    original = code
    
    # Update container sections
    code = re.sub(r'rounded-\[1\.85rem\] bg-card p-5 shadow-\[[^\]]+\] md:p-6', f'{glass_container} p-5 md:p-6', code)
    code = re.sub(r'rounded-\[1\.85rem\] bg-card shadow-\[[^\]]+\]', glass_container, code)
    
    # ProductMetaPanel inner panels and ProductContentReviewPanel
    code = re.sub(r'rounded-\[1\.4rem\] border border-border bg-card p-4 shadow-sm', f'{glass_container} p-4', code)
    code = re.sub(r'rounded-2xl border border-border bg-background p-4', f'{glass_container} p-4', code)
    code = re.sub(r'rounded-2xl border border-border bg-card p-5 shadow-sm', f'{glass_container} p-5', code)
    code = re.sub(r'rounded-2xl border border-border bg-card p-4 shadow-sm', f'{glass_container} p-4', code)
    code = re.sub(r'border-b border-border bg-gradient-to-br from-primary/10 via-card to-card', r'border-b border-border/30 bg-gradient-to-br from-primary/10 via-transparent to-transparent', code)
    
    # Inputs
    code = re.sub(r"'w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/45 focus:ring-2 focus:ring-primary/15'", r"'admin-glass-input w-full'", code)
    code = re.sub(r'w-full rounded-2xl border border-input bg-background px-3 py-2', r'w-full admin-glass-input', code)
    code = re.sub(r'block w-full rounded-md border-input bg-background shadow-sm focus:border-primary focus:ring-primary sm:text-sm', r'w-full admin-glass-input', code)
    code = re.sub(r'p-2 border border-input rounded-md bg-background', r'admin-glass-input', code)
    
    if code != original:
        with open(filepath, "w") as f:
            f.write(code)
        print(f"Updated {filepath}")
