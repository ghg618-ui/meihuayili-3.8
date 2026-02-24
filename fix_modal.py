import re
# Read CSS
css = open("index.css").read()
# Find where modal CSS starts
start = css.find("/* --- Modals --- */")
modal_css = css[start:]

# Read HTML
html = open("index.html").read()

# Insert before </head>
style_block = f"\n    <style>\n{modal_css}\n    </style>\n</head>"
html = html.replace("</head>", style_block)

open("index.html", "w").write(html)
print("Injected CSS into HTML!")
