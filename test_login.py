"""Test login button behavior with Playwright."""
import asyncio
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Enable console logging
        page.on("console", lambda msg: print(f"  CONSOLE [{msg.type}]: {msg.text}"))
        page.on("pageerror", lambda err: print(f"  PAGE ERROR: {err}"))

        print("1. Navigating to humbleb.vercel.app...")
        response = await page.goto("https://humbleb.vercel.app/", wait_until="networkidle", timeout=30000)
        print(f"   Status: {response.status}")
        print(f"   URL: {page.url}")

        # Wait for page to render
        await page.wait_for_timeout(3000)

        # Screenshot
        await page.screenshot(path="/tmp/humbleb_home.png", full_page=True)
        print("   Screenshot saved: /tmp/humbleb_home.png")

        # Check page content
        content = await page.content()
        print(f"   Page length: {len(content)}")

        # Look for login button
        kakao_btn = await page.query_selector('a[href*="kakao"], a[href*="auth"]')
        if kakao_btn:
            href = await kakao_btn.get_attribute("href")
            text = await kakao_btn.inner_text()
            print(f"2. Found login button: text='{text}', href='{href}'")

            # Click and see what happens
            print("3. Clicking login button...")

            # Listen for navigation
            async with page.expect_navigation(timeout=10000, wait_until="commit") as nav_info:
                await kakao_btn.click()

            nav = await nav_info.value
            print(f"   Navigated to: {page.url}")
            print(f"   Status: {nav.status if nav else 'no response'}")
            await page.screenshot(path="/tmp/humbleb_after_click.png", full_page=True)
            print("   Screenshot saved: /tmp/humbleb_after_click.png")
        else:
            print("2. No login button found!")
            # Check what's on the page
            all_links = await page.query_selector_all("a")
            for link in all_links:
                href = await link.get_attribute("href")
                text = await link.inner_text()
                print(f"   Link: text='{text}', href='{href}'")

            all_buttons = await page.query_selector_all("button")
            for btn in all_buttons:
                text = await btn.inner_text()
                print(f"   Button: text='{text}'")

        await browser.close()


asyncio.run(main())
