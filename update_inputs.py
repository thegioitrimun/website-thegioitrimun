import os
import glob
import re

css_to_add = """
.admin-glass-input {
  @apply rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] transition-all hover:ring-1 hover:ring-primary/30 focus:ring-2 focus:ring-primary/50 focus:outline-none px-4 py-2 text-sm placeholder:text-muted-foreground/70;
}
.dark .admin-glass-input {
  @apply shadow-[inset_0_1px_3px_rgba(0,0,0,0.4),0_1px_0_rgba(255,255,255,0.05)];
}
"""

with open("src/index.css", "r") as f:
    content = f.read()
    
if ".admin-glass-input" not in content:
    content = content.replace("@layer components {", "@layer components {\n" + css_to_add)
    with open("src/index.css", "w") as f:
        f.write(content)
    print("Updated index.css")

files = glob.glob("components/Admin*.tsx") + glob.glob("components/AdministrativeProfilePage.tsx")

for filepath in files:
    with open(filepath, "r") as f:
        code = f.read()
        
    original_code = code
    
    # Common input classes replacement
    # 1. p-2 border border-input rounded-md bg-background
    code = re.sub(r'p-2 border border-input rounded-md bg-background', r'admin-glass-input', code)
    
    # 2. block w-full rounded-md border-input bg-background shadow-sm focus:border-primary focus:ring-primary sm:text-sm
    code = re.sub(r'block w-full rounded-md border-input bg-background shadow-sm focus:border-primary focus:ring-primary sm:text-sm', r'w-full admin-glass-input', code)
    code = re.sub(r'w-full block rounded-md border-input bg-background shadow-sm focus:border-primary focus:ring-primary sm:text-sm', r'w-full admin-glass-input', code)
    
    # 3. w-full rounded-xl border border-input bg-background px-3 py-2 text-sm
    code = re.sub(r'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm', r'w-full admin-glass-input', code)
    
    # 4. w-full rounded-xl border border-input bg-background px-3 py-2
    code = re.sub(r'w-full rounded-xl border border-input bg-background px-3 py-2', r'w-full admin-glass-input', code)
    
    # 5. p-1 border border-input rounded-md bg-background
    code = re.sub(r'p-1 border border-input rounded-md bg-background', r'admin-glass-input !p-1', code)
    
    # 6. w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50
    code = re.sub(r'w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50', r'w-full admin-glass-input', code)
    
    if code != original_code:
        with open(filepath, "w") as f:
            f.write(code)
        print(f"Updated {filepath}")

