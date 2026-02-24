from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.on("console", lambda msg: print(f"Console: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PageError: {err}"))
        
        page.goto("file:///Users/gong-ai/梅花易数起卦/index.html")
        
        # Click user trigger
        print("Clicking user trigger")
        page.click("#user-trigger")
        page.wait_for_timeout(500)
        
        # Click login
        print("Clicking auth submit")
        page.fill("#auth-username", "testuser")
        page.fill("#auth-password", "123456")
        page.click("#btn-auth-submit")
        page.wait_for_timeout(500)
        
        # Check error message
        err_msg = page.locator("#auth-msg-error").inner_text()
        print(f"Auth error message: {err_msg}")
        
        browser.close()

if __name__ == "__main__":
    run()
