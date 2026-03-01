from fpdf import FPDF

class SOP_PDF(FPDF):
    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(140, 140, 140)
        self.cell(0, 8, "Real Estate Builder CRM - SOP Document", align="R")
        self.ln(12)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(160, 160, 160)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title):
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(30, 58, 138)  # dark blue
        self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
        # underline
        self.set_draw_color(30, 58, 138)
        self.set_line_width(0.5)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def sub_title(self, title):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(55, 65, 81)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body_text(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(55, 65, 81)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def tag_text(self, text):
        """For the (exists in separate_crm) tags"""
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(22, 163, 74)  # green
        self.cell(0, 5, text, new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(55, 65, 81)
        self.ln(2)

    def bullet(self, text, indent=15):
        x = self.get_x()
        self.set_font("Helvetica", "", 10)
        self.set_text_color(55, 65, 81)
        self.cell(indent, 5.5, "-")
        self.multi_cell(0, 5.5, text)
        self.ln(1)

    def table_row(self, col1, col2, bold=False):
        style = "B" if bold else ""
        self.set_font("Helvetica", style, 10)
        if bold:
            self.set_fill_color(30, 58, 138)
            self.set_text_color(255, 255, 255)
        else:
            self.set_fill_color(243, 244, 246)
            self.set_text_color(55, 65, 81)
        w1 = 75
        w2 = self.w - self.l_margin - self.r_margin - w1
        self.cell(w1, 8, f"  {col1}", border=1, fill=True)
        self.cell(w2, 8, f"  {col2}", border=1, fill=True, new_x="LMARGIN", new_y="NEXT")

    def alt_table_row(self, col1, col2, row_idx):
        self.set_font("Helvetica", "", 10)
        if row_idx % 2 == 0:
            self.set_fill_color(249, 250, 251)
        else:
            self.set_fill_color(255, 255, 255)
        self.set_text_color(55, 65, 81)
        w1 = 75
        w2 = self.w - self.l_margin - self.r_margin - w1
        self.cell(w1, 8, f"  {col1}", border=1, fill=True)
        self.cell(w2, 8, f"  {col2}", border=1, fill=True, new_x="LMARGIN", new_y="NEXT")

    def phase_box(self, phase, title, items, color):
        r, g, b = color
        self.set_fill_color(r, g, b)
        self.set_draw_color(r - 30 if r > 30 else 0, g - 30 if g > 30 else 0, b - 30 if b > 30 else 0)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(255, 255, 255)
        self.cell(0, 8, f"  {phase}: {title}", border=1, fill=True, new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 9)
        self.set_text_color(55, 65, 81)
        self.set_fill_color(255, 255, 255)
        for item in items:
            self.cell(0, 6, f"     - {item}", border="LR", fill=True, new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 2, "", border="LRB", fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)


# ─── BUILD THE PDF ───
pdf = SOP_PDF()
pdf.alias_nb_pages()

# ─── COVER PAGE ───
pdf.add_page()
pdf.ln(50)
pdf.set_font("Helvetica", "B", 28)
pdf.set_text_color(30, 58, 138)
pdf.cell(0, 15, "Real Estate Builder CRM", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(3)
pdf.set_font("Helvetica", "", 14)
pdf.set_text_color(100, 116, 139)
pdf.cell(0, 10, "Standard Operating Procedure", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(2)
pdf.set_draw_color(30, 58, 138)
pdf.set_line_width(1)
pdf.line(60, pdf.get_y(), pdf.w - 60, pdf.get_y())
pdf.ln(10)
pdf.set_font("Helvetica", "", 11)
pdf.set_text_color(100, 116, 139)
pdf.cell(0, 8, "Built on top of: separate_crm project (existing codebase)", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 8, "Target Customer: Real Estate Builders / Developers", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 8, "Product Type: SaaS - Sell to multiple builders", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(20)
pdf.set_font("Helvetica", "I", 10)
pdf.set_text_color(160, 160, 160)
pdf.cell(0, 8, "Prepared: March 2026", align="C", new_x="LMARGIN", new_y="NEXT")

# ─── PAGE 2: WHAT ARE WE BUILDING ───
pdf.add_page()
pdf.section_title("1. What Are We Building?")
pdf.body_text(
    "A CRM platform designed specifically for real estate builders. "
    "Not a generic CRM with property fields bolted on - a purpose-built sales system "
    "that mirrors how builders actually sell: Projects > Units > Leads > Bookings > Collections."
)
pdf.body_text(
    "The product will be sold to multiple builders as a SaaS platform. "
    "Each builder gets their own tenant with their branding, projects, and team."
)

pdf.sub_title("Users of the System")
pdf.bullet("Sales Agents - handle buyer inquiries, site visits, closings")
pdf.bullet("Sales Manager / Admin - oversee pipeline, assign leads, track team performance")
pdf.bullet("Channel Partners (Brokers) - submit leads, track their commissions (optional module)")
pdf.bullet("Builder Owner - sees dashboard, revenue, inventory status")

pdf.sub_title("Tech Stack")
pdf.tag_text("(All of below already exists in separate_crm)")
pdf.bullet("Frontend: React 18 + TypeScript + Vite + Tailwind CSS + Shadcn/ui")
pdf.bullet("Real-time: Pusher.js + Laravel Echo (WebSockets)")
pdf.bullet("State: Zustand + TanStack Query")
pdf.bullet("Forms: React Hook Form + Zod validation")
pdf.bullet("Charts: ApexCharts + Recharts")
pdf.bullet("PDF/Excel: jspdf + html2canvas + xlsx")

# ─── PAGE 3: THE 6 MODULES ───
pdf.add_page()
pdf.section_title("2. The 6 Core Modules")
pdf.ln(2)

# Module 1
pdf.sub_title("Module 1: Project & Inventory Manager")
pdf.tag_text("(NEW - does not exist in separate_crm)")
pdf.bullet("Add projects with: name, RERA number, location, total units, launch date")
pdf.bullet("Tower/Phase management under each project")
pdf.bullet("Unit grid view - visual floor x flat grid, color-coded by status")
pdf.bullet("Unit statuses: Available > Reserved > Booked > Registered > Sold")
pdf.bullet("Unit details: BHK, carpet area, floor, facing, base price")
pdf.bullet("Price calculator: base + floor rise + facing premium + parking")
pdf.ln(2)

# Module 2
pdf.sub_title("Module 2: Lead & Pipeline CRM")
pdf.tag_text("(EXISTS in separate_crm - CRM module, needs field adaptation)")
pdf.bullet("Lead = potential buyer with: name, phone, budget, BHK preference, locality")
pdf.bullet("Lead source tracking: broker, website, Meta ads, walk-in, referral, WhatsApp")
pdf.bullet("Auto property matching: system flags units matching buyer requirements")
pdf.bullet("Activity tracking: calls, WhatsApp messages, site visits, follow-ups")
pdf.bullet("Tasks & meetings management for agents")
pdf.ln(1)
pdf.body_text("Pipeline Stages:")
pdf.body_text(
    "Inquiry > Qualified > Site Visit Scheduled > Site Visit Done > "
    "Shortlisted Unit > Negotiation > Token Paid > Agreement > Registered > Closed"
)

# Module 3
pdf.sub_title("Module 3: Booking & Payment Collections")
pdf.tag_text("(NEW - PDF generation exists in separate_crm, rest is new)")
pdf.bullet("Booking form: link buyer to a specific unit, capture token amount")
pdf.bullet("Auto-generate payment schedule (20:80, construction-linked, custom)")
pdf.bullet("Track each milestone: due date, received, pending")
pdf.bullet("Demand letters & receipts as PDF (using existing jspdf)")
pdf.bullet("WhatsApp payment reminders before each due date")

pdf.add_page()

# Module 4
pdf.sub_title("Module 4: WhatsApp Sales Engine")
pdf.tag_text("(EXISTS in separate_crm - full WhatsApp module with chat, broadcast, templates, flows)")
pdf.bullet("Real-time chat with buyers via WhatsApp")
pdf.bullet("One-click property card sharing: photo + specs + price + location")
pdf.bullet("Automated follow-up sequences per pipeline stage")
pdf.bullet("Broadcast to segmented buyers (e.g., '3BHK buyers under 2Cr in Pune')")
pdf.bullet("Template library: inquiry reply, site visit confirmation, booking congrats, payment reminder")
pdf.bullet("Flow automation editor for complex sequences")
pdf.ln(2)

# Module 5
pdf.sub_title("Module 5: Channel Partner (Broker) Portal")
pdf.tag_text("(PARTIALLY EXISTS - RBAC/auth in separate_crm, broker-specific features are new)")
pdf.bullet("Broker registration & login with their own dashboard")
pdf.bullet("Submit leads that appear in builder's CRM tagged to broker")
pdf.bullet("Commission tracking per booking (auto-calculated)")
pdf.bullet("Broker leaderboard & performance reports")
pdf.bullet("Optional: brokers share property cards via WhatsApp from their portal")
pdf.ln(2)

# Module 6
pdf.sub_title("Module 6: Builder Dashboard & Reports")
pdf.tag_text("(EXISTS in separate_crm - dashboard, charts, analytics module)")
pdf.bullet("Inventory health: available / reserved / booked / sold per project")
pdf.bullet("Sales funnel: leads at each stage + conversion rates")
pdf.bullet("Revenue: total bookings value, collections received vs pending")
pdf.bullet("Agent leaderboard: site visits, bookings, conversion rate")
pdf.bullet("Lead source ROI: which source brings most closings")

# ─── PAGE: REUSE MAP ───
pdf.add_page()
pdf.section_title("3. Codebase Reuse Map")
pdf.body_text("How much of separate_crm is reused vs what's new:")
pdf.ln(2)

pdf.table_row("Feature", "Status")
pdf.alt_table_row("WhatsApp Chat + Broadcast", "100% Reuse from separate_crm", 0)
pdf.alt_table_row("WhatsApp Flow Editor", "100% Reuse from separate_crm", 1)
pdf.alt_table_row("WhatsApp Templates", "100% Reuse from separate_crm", 2)
pdf.alt_table_row("Lead CRUD + Pipeline", "80% Reuse - add RE-specific fields", 3)
pdf.alt_table_row("Activities / Tasks / Meetings", "90% Reuse - minor label changes", 4)
pdf.alt_table_row("Dashboard + Charts", "70% Reuse - new RE-specific widgets", 5)
pdf.alt_table_row("Auth + RBAC + Roles", "90% Reuse - add broker role", 6)
pdf.alt_table_row("UI Components (Shadcn)", "100% Reuse from separate_crm", 7)
pdf.alt_table_row("Real-time (Pusher/Echo)", "100% Reuse from separate_crm", 8)
pdf.alt_table_row("PDF / Excel Generation", "80% Reuse - new templates", 9)
pdf.alt_table_row("Project & Unit Inventory", "NEW - build from scratch", 10)
pdf.alt_table_row("Booking & Payment Tracker", "NEW - build from scratch", 11)
pdf.alt_table_row("Channel Partner Portal", "NEW - build from scratch", 12)

pdf.ln(5)
pdf.set_font("Helvetica", "B", 12)
pdf.set_text_color(22, 163, 74)
pdf.cell(0, 8, "Estimated Reuse: ~65-70% of existing codebase", new_x="LMARGIN", new_y="NEXT")
pdf.set_text_color(55, 65, 81)

# ─── PAGE: BUILD PHASES ───
pdf.add_page()
pdf.section_title("4. Phased Build Plan")
pdf.body_text("Ship in phases. Each phase is independently usable and sellable.")
pdf.ln(3)

pdf.phase_box("Phase 1", "Core CRM + Inventory (Foundation)", [
    "Project & Unit Inventory module (NEW)",
    "Adapt Lead CRM with real estate fields (MODIFY existing)",
    "Builder Dashboard with inventory + funnel charts (MODIFY existing)",
    "Auth & RBAC with builder roles (MODIFY existing)",
], (30, 58, 138))

pdf.phase_box("Phase 2", "WhatsApp Sales Engine (Differentiator)", [
    "Property card sharing via WhatsApp (MODIFY existing)",
    "Stage-based auto follow-up sequences (EXISTS - configure)",
    "Buyer segment broadcasts (EXISTS - configure)",
    "Template library for real estate (MODIFY existing)",
], (79, 70, 229))

pdf.phase_box("Phase 3", "Booking & Collections (Revenue Tracking)", [
    "Booking form linking buyer to unit (NEW)",
    "Payment milestone schedule generator (NEW)",
    "WhatsApp payment reminders (MODIFY existing flows)",
    "PDF demand letters & receipts (MODIFY existing PDF gen)",
], (22, 163, 74))

pdf.phase_box("Phase 4", "Channel Partner Portal (Growth)", [
    "Broker registration + login (NEW, uses existing auth)",
    "Lead submission from broker (NEW)",
    "Commission calculator (NEW)",
    "Broker dashboard & leaderboard (NEW, uses existing chart components)",
], (245, 158, 11))

pdf.phase_box("Phase 5", "Multi-Tenant + White Label (Scale)", [
    "Tenant isolation (tenant_id scoping in backend)",
    "White-label: logo, colors, subdomain per builder",
    "Configurable pipeline stages per tenant",
    "Configurable payment plan templates per tenant",
], (239, 68, 68))

# ─── PAGE: REAL LIFE EXAMPLE ───
pdf.add_page()
pdf.section_title("5. Real-Life Example: A Day in the Builder's CRM")
pdf.ln(2)

pdf.set_font("Helvetica", "B", 11)
pdf.set_text_color(30, 58, 138)
pdf.cell(0, 8, 'Builder: "Sunrise Developers" | Project: "Sunrise Heights" (3 towers, 240 flats)', new_x="LMARGIN", new_y="NEXT")
pdf.ln(3)

steps = [
    ("9:00 AM - New Lead Comes In",
     "Rahul (buyer) fills an inquiry form on the website. "
     "Lead auto-creates in CRM with source = 'Website'. "
     "Assigned to Agent Priya. "
     "WhatsApp auto-sends: 'Hi Rahul, thanks for your interest in Sunrise Heights! "
     "Our executive Priya will connect with you shortly.'"),

    ("9:15 AM - Agent Qualifies the Lead",
     "Priya calls Rahul. Updates CRM: Budget 80L-1Cr, wants 2BHK, "
     "prefers Tower B (garden facing). Moves lead to 'Qualified'. "
     "CRM auto-suggests 4 available 2BHK units in Tower B matching his budget."),

    ("9:20 AM - Property Shared via WhatsApp",
     "Priya clicks 'Share via WhatsApp' on Unit B-403 (2BHK, 850sqft, 92L). "
     "Rahul receives a rich card: photo, floor plan, price breakdown, location map. "
     "All within the same WhatsApp chat thread."),

    ("10:00 AM - Site Visit Booked",
     "Rahul is interested. Priya schedules a site visit for Saturday. "
     "Moves lead to 'Site Visit Scheduled'. "
     "WhatsApp auto-sends: 'Your site visit is confirmed for Sat, 10 AM. "
     "Here is the location: [Google Maps link].'"),

    ("Saturday - Site Visit Done",
     "Priya marks visit complete, adds notes: 'Liked B-403, wants to negotiate.' "
     "Moves to 'Negotiation'. Unit B-403 status changes to 'Reserved' on the grid. "
     "No other agent can offer this unit now."),

    ("Monday - Deal Closed!",
     "Rahul agrees at 90L. Priya creates a Booking: Buyer=Rahul, Unit=B-403, "
     "Amount=90L. System auto-generates payment plan: 10L token > 20L in 30 days > "
     "remaining on possession. Unit status = 'Booked' on the grid. "
     "WhatsApp sends: 'Congratulations Rahul! Your 2BHK at Sunrise Heights is booked!'"),

    ("Day 25 - Payment Reminder",
     "5 days before the 20L installment is due, Rahul gets an auto WhatsApp: "
     "'Hi Rahul, a friendly reminder that your payment of 20L for Unit B-403 "
     "is due on April 5th. Here is the bank details: [...]' "
     "Manager sees on dashboard: 45 units sold, 12 payments pending this month."),

    ("Meanwhile - Broker Vinod",
     "Broker Vinod logs into his Channel Partner portal. "
     "Submits 3 new buyer leads. One of them books a flat. "
     "Vinod's dashboard shows: commission of 1.8L earned. "
     "Builder's dashboard shows: 15% of bookings came from channel partners."),
]

for i, (title, desc) in enumerate(steps):
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(30, 58, 138)
    pdf.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9.5)
    pdf.set_text_color(75, 85, 99)
    pdf.multi_cell(0, 5, desc)
    pdf.ln(3)

# ─── FINAL PAGE: SUMMARY ───
pdf.add_page()
pdf.section_title("6. One-Page Summary for Quick Review")
pdf.ln(3)

pdf.set_font("Helvetica", "B", 11)
pdf.set_text_color(55, 65, 81)

summary_items = [
    "PRODUCT: Real Estate Builder CRM with WhatsApp integration",
    "TARGET: Sell as SaaS to multiple real estate builders",
    "CODEBASE: 65-70% reuse from existing separate_crm project",
    "NEW WORK: Project/Unit inventory + Bookings + Payment tracker + Broker portal",
    "BIGGEST EDGE: WhatsApp automation (already built!) - no competitor has this",
    "BACKEND: Existing backend with modifications (tenant_id + new tables)",
    "PHASES: 5 phases, Phase 1 alone is a sellable product",
]

for item in summary_items:
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(30, 58, 138)
    key, value = item.split(":", 1)
    pdf.cell(3, 7, ">")  # arrow
    pdf.cell(30, 7, key + ":")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(55, 65, 81)
    pdf.cell(0, 7, value.strip(), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

pdf.ln(10)
pdf.set_draw_color(30, 58, 138)
pdf.set_line_width(0.5)
pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
pdf.ln(5)
pdf.set_font("Helvetica", "I", 10)
pdf.set_text_color(100, 116, 139)
pdf.cell(0, 8, "Ready for review. Awaiting feedback to begin Phase 1 development.", align="C")

# ─── SAVE ───
pdf.output("/home/user/sepratecrm/Real_Estate_CRM_SOP.pdf")
print("PDF generated successfully!")
