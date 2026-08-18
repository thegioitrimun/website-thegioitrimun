import re
import glob

glass = "rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0"

files = [
    "components/ProductEditorForm.tsx",
    "components/ProductEditorHeader.tsx",
    "components/ProductContentReviewPanel.tsx",
    "components/FAQEditor.tsx",
    "components/MediaUploader.tsx"
]

for filepath in files:
    with open(filepath, "r") as f:
        code = f.read()
    
    orig = code
    
    # Replace different variations of bg-card shadow containers
    code = re.sub(r'rounded-\[1\.7rem\] bg-card p-5 shadow-\[[^\]]+\]', f'{glass} p-5', code)
    code = re.sub(r'rounded-\[2rem\] bg-card px-5 py-5 shadow-\[[^\]]+\] md:px-6', f'{glass} p-5 md:p-6', code)
    code = re.sub(r'rounded-\[1\.85rem\] bg-card p-5 shadow-\[[^\]]+\] md:p-6', f'{glass} p-5 md:p-6', code)
    
    # Check for any other bg-card in these files that might be panels
    code = re.sub(r'rounded-2xl border border-border bg-card p-5', f'{glass} p-5', code)
    code = re.sub(r'rounded-2xl border border-border bg-background p-4', f'{glass} p-4', code)
    
    # Fix inputs in FAQEditor and MediaUploader
    if "FAQEditor" in filepath or "MediaUploader" in filepath or "ProductEditorForm" in filepath:
        code = re.sub(r"'w-full rounded-2xl border border-input bg-background px-3 py-2\.5 text-sm text-foreground outline-none transition-colors focus:border-primary/45 focus:ring-2 focus:ring-primary/15'", r"'admin-glass-input w-full'", code)
        code = re.sub(r'w-full rounded-2xl border border-input bg-background px-3 py-2', r'w-full admin-glass-input', code)
        code = re.sub(r'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm', r'w-full admin-glass-input', code)
        code = re.sub(r'p-2 border border-input rounded-md bg-background', r'admin-glass-input', code)
    
    if code != orig:
        with open(filepath, "w") as f:
            f.write(code)
        print(f"Fixed {filepath}")
