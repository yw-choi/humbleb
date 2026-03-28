import { test, expect, Page } from "@playwright/test";

const API = "http://127.0.0.1:8200";
const B = "/humbleb"; // basePath
const MEMBER_ID = "94a44048-5bac-4de4-9d00-b4c3f6e17322"; // 영우 (admin)

async function loginAs(page: Page, memberId: string) {
  const resp = await page.request.get(
    `${API}/auth/dev-login?member_id=${memberId}`,
    { maxRedirects: 0 },
  );
  const location = resp.headers()["location"] || "";
  const token = location.split("token=")[1];
  if (!token) throw new Error("No token in redirect: " + location);

  await page.goto(`${B}`);
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate((t) => {
    localStorage.setItem("humbleb_token", t);
  }, token);
  await page.goto(`${B}`);
  await page.waitForLoadState("load");
  await page.waitForTimeout(3000);
}

// ─── Login page ───

test("login page renders", async ({ page }) => {
  await page.goto(`${B}`);
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000);
  await expect(page.locator("text=카카오 로그인")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("text=HumbleB")).toBeVisible();
});

test("login button is tappable (>=48px)", async ({ page }) => {
  await page.goto(`${B}`);
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000);
  const btn = page.locator("a:has-text('카카오 로그인')");
  await expect(btn).toBeVisible({ timeout: 10_000 });
  const box = await btn.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);
});

// ─── Main page ───

test("main page after login", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await expect(page.locator("text=영우")).toBeVisible({ timeout: 10_000 });
  await expect(
    page.locator("text=다가오는 모임").or(page.locator("text=예정된 모임이 없습니다")),
  ).toBeVisible({ timeout: 5_000 });
});

test("main page - font sizes >= 12px", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.waitForTimeout(2000);
  const issues = await page.evaluate(() => {
    const found: string[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const s = getComputedStyle(el);
      const fs = parseFloat(s.fontSize);
      const t = (el as HTMLElement).innerText?.trim();
      if (t && t.length > 0 && t.length < 100 && fs < 12) {
        found.push(`"${t.slice(0, 30)}" → ${fs}px`);
      }
    });
    return [...new Set(found)];
  });
  console.log("Font size issues:", issues.length ? issues : "none");
});

test("main page - contrast check (dark mode)", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.waitForTimeout(2000);
  const issues = await page.evaluate(() => {
    const found: string[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const s = getComputedStyle(el);
      const t = (el as HTMLElement).innerText?.trim();
      if (t && t.length > 0 && t.length < 50) {
        const m = s.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) {
          const lum = 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3];
          if (lum < 60 && lum > 5) {
            found.push(`"${t.slice(0, 25)}" rgb(${m[1]},${m[2]},${m[3]}) lum=${Math.round(lum)}`);
          }
        }
      }
    });
    return [...new Set(found)];
  });
  console.log("Low contrast:", issues.length ? issues : "none");
});

test("main page - closed schedules count", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.waitForTimeout(2000);
  const total = await page.locator("[class*='rounded-2xl'][class*='border']").count();
  const closed = await page.locator("text=마감").count();
  console.log(`Cards: ${total}, Closed: ${closed}`);
});

test("main page - buttons >= 44px touch target", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.waitForTimeout(2000);
  const btns = page.locator("button");
  const count = await btns.count();
  const small: string[] = [];
  for (let i = 0; i < count; i++) {
    const box = await btns.nth(i).boundingBox();
    const label = await btns.nth(i).innerText().catch(() => "?");
    if (box && (box.height < 44 || box.width < 44)) {
      small.push(`"${label.trim().slice(0, 20)}" ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
  }
  console.log("Small buttons:", small.length ? small : "none");
});

// ─── Bottom Tab Navigation ───

test("bottom tabs exist (일정, 기록, 통계)", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.waitForTimeout(2000);
  await expect(page.locator("nav button:has-text('일정')")).toBeVisible();
  await expect(page.locator("nav button:has-text('기록')")).toBeVisible();
  await expect(page.locator("nav button:has-text('통계')")).toBeVisible();
});

test("tab switch to 기록", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.waitForTimeout(2000);
  await page.locator("nav button:has-text('기록')").click();
  await page.waitForTimeout(1000);
  // Should show history content or empty state
  const content = page.locator("text=지난 모임이 없습니다").or(page.locator(".card-press"));
  await expect(content.first()).toBeVisible({ timeout: 5_000 });
});

test("tab switch to 통계", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.waitForTimeout(2000);
  await page.locator("nav button:has-text('통계')").click();
  await page.waitForTimeout(2000);
  // Should show member stats cards or empty state
  const content = page.locator("text=아직 통계 데이터가 없습니다").or(page.locator("text=0게임").first());
  await expect(content.first()).toBeVisible({ timeout: 5_000 });
});

// ─── Admin ───

test("admin page loads", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.goto(`${B}/admin`);
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000);
  await expect(page.locator("text=관리").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("text=일정 생성")).toBeVisible();
});

// ─── Redirects ───

test("history URL redirects to main", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.goto(`${B}/history`);
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000);
  // Should end up on main page with history tab
  expect(page.url()).toContain("tab=history");
});

test("stats URL redirects to main", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.goto(`${B}/stats`);
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000);
  expect(page.url()).toContain("tab=stats");
});

// ─── Schedule Detail ───

test("schedule detail dark mode compatible", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  // Get first schedule link
  const firstCard = page.locator("a[href*='/schedule/']").first();
  if (await firstCard.isVisible()) {
    await firstCard.click();
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);
    // Check no hardcoded gray classes
    const badColors = await page.evaluate(() => {
      const found: string[] = [];
      document.querySelectorAll("*").forEach((el) => {
        const cls = el.className;
        if (typeof cls === "string" && cls.includes("gray-")) {
          found.push(`${el.tagName}: ${cls}`);
        }
      });
      return found;
    });
    expect(badColors).toHaveLength(0);
  }
});

// ─── Screenshots for visual audit ───

test("screenshot: login", async ({ page }) => {
  await page.goto(`${B}`);
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000);
});

test("screenshot: main (logged in)", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.waitForTimeout(3000);
});

test("screenshot: admin", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.goto(`${B}/admin`);
  await page.waitForLoadState("load");
  await page.waitForTimeout(3000);
});

test("screenshot: history tab", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.waitForTimeout(2000);
  await page.locator("nav button:has-text('기록')").click();
  await page.waitForTimeout(2000);
});

test("screenshot: stats tab", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.waitForTimeout(2000);
  await page.locator("nav button:has-text('통계')").click();
  await page.waitForTimeout(2000);
});

test("screenshot: schedule detail", async ({ page }) => {
  await loginAs(page, MEMBER_ID);
  await page.waitForTimeout(2000);
  const firstCard = page.locator("a[href*='/schedule/']").first();
  if (await firstCard.isVisible()) {
    await firstCard.click();
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);
  }
});
