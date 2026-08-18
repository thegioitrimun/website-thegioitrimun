import re

glass = "bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0"

files = [
    "components/MediaUploader.tsx",
    "components/ProductMetaPanel.tsx",
    "components/ProductEditorForm.tsx",
    "components/DetailFaqEditor.tsx",
    "components/LocalSeoTagsEditor.tsx"
]

for filepath in files:
    with open(filepath, "r") as f:
        code = f.read()
    
    orig = code
    
    # Replace MediaUploader
    code = code.replace("rounded-[1.6rem] bg-background", f"rounded-[1.6rem] {glass}")
    code = code.replace("rounded-[1.45rem] bg-background", f"rounded-[1.45rem] {glass}")
    
    # Replace ProductMetaPanel
    code = code.replace("rounded-[1.3rem] border border-border bg-background", f"rounded-[1.3rem] {glass}")
    code = code.replace("rounded-[1.15rem] border border-border bg-background", f"rounded-[1.15rem] {glass}")
    code = code.replace("rounded-[1.2rem] border border-border bg-background", f"rounded-[1.2rem] {glass}")
    code = code.replace("rounded-[1.1rem] border border-border bg-background", f"rounded-[1.1rem] {glass}")
    
    # Replace ProductEditorForm
    code = code.replace("rounded-[1.25rem] border border-border bg-background", f"rounded-[1.25rem] {glass}")
    
    # Replace DetailFaqEditor
    code = code.replace("rounded-lg bg-background p-4", f"rounded-[1.3rem] {glass} p-4")
    code = code.replace("rounded-lg border p-4", "rounded-[1.5rem] bg-transparent border-0 p-4")
    
    # Replace inputs in DetailFaqEditor and LocalSeoTagsEditor
    code = code.replace("border-input bg-background p-2", "admin-glass-input p-2")
    
    if code != orig:
        with open(filepath, "w") as f:
            f.write(code)
        print(f"Fixed {filepath}")
