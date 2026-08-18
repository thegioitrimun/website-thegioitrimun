import re

filepath = "components/PostEditorForm.tsx"
with open(filepath, "r") as f:
    code = f.read()

# Replace the fieldset container
code = code.replace(
    'className="space-y-4 rounded-[1.6rem] border border-border/80 bg-secondary/20 p-5 md:p-6 scroll-mt-28"',
    'className="space-y-4 rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-5 md:p-6 scroll-mt-28"'
)

# Also update the taxonomy container just above it for consistency
code = code.replace(
    'className="grid grid-cols-1 md:grid-cols-2 gap-6 scroll-mt-28"',
    'className="grid grid-cols-1 md:grid-cols-2 gap-6 scroll-mt-28 rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-5 md:p-6"'
)

# And the title/excerpt container at the top (if any) - let's just do global input replacement first
code = re.sub(r'w-full p-2 border border-input rounded-md bg-background', r'w-full admin-glass-input', code)
code = re.sub(r'w-full p-2 border border-input rounded-md bg-muted/50', r'w-full admin-glass-input bg-muted/20 opacity-80', code)
code = re.sub(r'className="w-full px-4 py-2 text-xl font-bold bg-transparent border-b-2 border-transparent hover:border-border focus:border-primary focus:outline-none transition-colors"', r'className="w-full px-4 py-3 text-xl font-bold bg-transparent border-b border-border/50 hover:border-primary/50 focus:border-primary focus:outline-none transition-colors"', code)

with open(filepath, "w") as f:
    f.write(code)

print("Updated PostEditorForm.tsx")
