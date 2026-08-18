import re

glass_card = "bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0"

filepath = "components/AdminPharmacyManagementPage.tsx"

with open(filepath, "r") as f:
    code = f.read()

def replace_tab_root(tab_name, old_class):
    return code.replace(
        f"{{activeTab === '{tab_name}' && (\n                    <div className=\"{old_class}\">",
        f"{{activeTab === '{tab_name}' && (\n                    <div className=\"{old_class} rounded-[1.7rem] {glass_card} p-3 md:p-5\">"
    )

code = replace_tab_root('products', 'space-y-5')
code = replace_tab_root('categories', 'space-y-6')
code = replace_tab_root('discounts', 'grid grid-cols-1 xl:grid-cols-5 gap-6')
code = replace_tab_root('taxes', 'space-y-6')
code = replace_tab_root('orders', 'space-y-5')
code = replace_tab_root('ghtk_settings', 'space-y-8')
code = replace_tab_root('brands', 'space-y-6')

with open(filepath, "w") as f:
    f.write(code)

print("Fixed tab roots")
