import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function daysFromNow(days: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  const org = await prisma.org.create({
    data: {
      name: "Horizon Realty",
      currency: "INR",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
    },
  });

  // ----- Configurable vocabularies -----
  const leadStatuses = [
    { value: "new", label: "New", color: "#4F46E5", order: 0 },
    { value: "contacted", label: "Contacted", color: "#0EA5E9", order: 1 },
    { value: "follow_up", label: "Follow Up", color: "#F59E0B", order: 2 },
    { value: "site_visit", label: "Site Visit", color: "#8B5CF6", order: 3 },
    { value: "negotiation", label: "Negotiation", color: "#14B8A6", order: 4 },
    { value: "converted", label: "Converted", color: "#22C55E", order: 5, meta: { won: true } },
    { value: "lost", label: "Lost", color: "#F43F5E", order: 6, meta: { lost: true } },
  ];
  const leadSources = [
    { value: "website", label: "Website", order: 0 },
    { value: "referral", label: "Referral", order: 1 },
    { value: "walk_in", label: "Walk-in", order: 2 },
    { value: "phone", label: "Phone", order: 3 },
    { value: "instagram", label: "Instagram", order: 4 },
    { value: "facebook", label: "Facebook", order: 5 },
  ];
  const propertyCategories = [
    { value: "apartment", label: "Apartment", order: 0 },
    { value: "villa", label: "Villa", order: 1 },
    { value: "penthouse", label: "Penthouse", order: 2 },
    { value: "plot", label: "Plot", order: 3 },
    { value: "commercial", label: "Commercial", order: 4 },
  ];
  const shifts = [
    { value: "morning", label: "Morning", order: 0 },
    { value: "evening", label: "Evening", order: 1 },
    { value: "night", label: "Night", order: 2 },
  ];

  await prisma.orgList.createMany({
    data: [
      ...leadStatuses.map((s) => ({ ...s, orgId: org.id, kind: "LEAD_STATUS" as const })),
      ...leadSources.map((s) => ({ ...s, orgId: org.id, kind: "LEAD_SOURCE" as const })),
      ...propertyCategories.map((s) => ({ ...s, orgId: org.id, kind: "PROPERTY_CATEGORY" as const })),
      ...shifts.map((s) => ({ ...s, orgId: org.id, kind: "SHIFT" as const })),
    ],
  });

  // ----- Team -----
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const [, manager, agent1, agent2] = await Promise.all([
    prisma.user.create({
      data: {
        orgId: org.id, name: "Sarah Mitchell", email: "admin@horizonrealty.test",
        passwordHash: hash("admin123"), role: "ADMIN", phone: "+91 98100 11001",
      },
    }),
    prisma.user.create({
      data: {
        orgId: org.id, name: "James Rodriguez", email: "manager@horizonrealty.test",
        passwordHash: hash("manager123"), role: "MANAGER", phone: "+91 98100 11002", shift: "morning",
      },
    }),
    prisma.user.create({
      data: {
        orgId: org.id, name: "Emily Chen", email: "emily@horizonrealty.test",
        passwordHash: hash("agent123"), role: "AGENT", phone: "+91 98100 11003", shift: "morning",
        targets: { monthlyConversions: 4, monthlyRevenue: 20000000 },
      },
    }),
    prisma.user.create({
      data: {
        orgId: org.id, name: "Marcus Johnson", email: "marcus@horizonrealty.test",
        passwordHash: hash("agent123"), role: "AGENT", phone: "+91 98100 11004", shift: "evening",
        targets: { monthlyConversions: 4, monthlyRevenue: 20000000 },
      },
    }),
  ]);

  // ----- Properties -----
  const propertyData = [
    { title: "Skyline Heights 3BHK", category: "apartment", price: 18500000, area: 1450, location: "Baner, Pune", bedrooms: 3, bathrooms: 3, amenities: ["Gym", "Pool", "Clubhouse", "Parking"], availability: "AVAILABLE" as const },
    { title: "Emerald Villa 4BHK", category: "villa", price: 42000000, area: 3200, location: "Kharadi, Pune", bedrooms: 4, bathrooms: 5, amenities: ["Private Garden", "Home Theatre", "Solar"], availability: "AVAILABLE" as const },
    { title: "The Crown Penthouse", category: "penthouse", price: 68000000, area: 4100, location: "Koregaon Park, Pune", bedrooms: 4, bathrooms: 5, amenities: ["Terrace Pool", "Concierge", "Smart Home"], availability: "RESERVED" as const },
    { title: "Green Acres Plot", category: "plot", price: 9500000, area: 2400, location: "Wagholi, Pune", amenities: ["Gated", "Corner Plot"], availability: "AVAILABLE" as const },
    { title: "Nexus Trade Center Office", category: "commercial", price: 25500000, area: 1800, location: "Hinjewadi, Pune", amenities: ["Cafeteria", "24x7 Access", "Power Backup"], availability: "UNDER_CONSTRUCTION" as const },
    { title: "Riverfront Residences 2BHK", category: "apartment", price: 12800000, area: 1050, location: "Aundh, Pune", bedrooms: 2, bathrooms: 2, amenities: ["River View", "Gym", "Play Area"], availability: "AVAILABLE" as const },
    { title: "Palm Grove Villa 5BHK", category: "villa", price: 55000000, area: 4000, location: "Bavdhan, Pune", bedrooms: 5, bathrooms: 6, amenities: ["Pool", "Landscaped Lawn", "Staff Quarters"], availability: "SOLD" as const },
    { title: "Metro Square Retail Unit", category: "commercial", price: 16000000, area: 950, location: "Viman Nagar, Pune", amenities: ["High Street", "Metro Access"], availability: "AVAILABLE" as const },
  ];
  const properties = await Promise.all(
    propertyData.map((p) => prisma.property.create({ data: { ...p, orgId: org.id } }))
  );

  // ----- Leads across the pipeline -----
  const leadData: Array<{
    name: string; email: string; phone: string; status: string; priority: "HIGH" | "MEDIUM" | "LOW";
    source: string; budget: number; propertyType: string; assignedToId: string;
    followUpDueAt?: Date; lostReason?: string; createdDaysAgo: number;
  }> = [
    { name: "Rohit Sharma", email: "rohit.s@example.com", phone: "+91 98220 10001", status: "new", priority: "HIGH", source: "website", budget: 20000000, propertyType: "apartment", assignedToId: agent1.id, createdDaysAgo: 0 },
    { name: "Priya Nair", email: "priya.n@example.com", phone: "+91 98220 10002", status: "new", priority: "MEDIUM", source: "instagram", budget: 13000000, propertyType: "apartment", assignedToId: agent2.id, createdDaysAgo: 1 },
    { name: "Arjun Mehta", email: "arjun.m@example.com", phone: "+91 98220 10003", status: "contacted", priority: "HIGH", source: "referral", budget: 45000000, propertyType: "villa", assignedToId: agent1.id, followUpDueAt: daysFromNow(1, 11), createdDaysAgo: 3 },
    { name: "Sneha Kulkarni", email: "sneha.k@example.com", phone: "+91 98220 10004", status: "contacted", priority: "LOW", source: "facebook", budget: 10000000, propertyType: "plot", assignedToId: agent2.id, followUpDueAt: daysFromNow(2, 15), createdDaysAgo: 4 },
    { name: "Vikram Singh", email: "vikram.s@example.com", phone: "+91 98220 10005", status: "follow_up", priority: "HIGH", source: "phone", budget: 26000000, propertyType: "commercial", assignedToId: agent1.id, followUpDueAt: daysFromNow(-1, 10), createdDaysAgo: 7 },
    { name: "Ananya Iyer", email: "ananya.i@example.com", phone: "+91 98220 10006", status: "follow_up", priority: "MEDIUM", source: "website", budget: 14000000, propertyType: "apartment", assignedToId: agent2.id, followUpDueAt: daysFromNow(0, 17), createdDaysAgo: 6 },
    { name: "Karan Kapoor", email: "karan.k@example.com", phone: "+91 98220 10007", status: "site_visit", priority: "HIGH", source: "referral", budget: 70000000, propertyType: "penthouse", assignedToId: agent1.id, createdDaysAgo: 10 },
    { name: "Divya Reddy", email: "divya.r@example.com", phone: "+91 98220 10008", status: "site_visit", priority: "MEDIUM", source: "walk_in", budget: 19000000, propertyType: "apartment", assignedToId: agent2.id, createdDaysAgo: 12 },
    { name: "Aditya Joshi", email: "aditya.j@example.com", phone: "+91 98220 10009", status: "negotiation", priority: "HIGH", source: "website", budget: 41000000, propertyType: "villa", assignedToId: agent1.id, createdDaysAgo: 18 },
    { name: "Meera Desai", email: "meera.d@example.com", phone: "+91 98220 10010", status: "negotiation", priority: "MEDIUM", source: "referral", budget: 15500000, propertyType: "commercial", assignedToId: agent2.id, createdDaysAgo: 20 },
    { name: "Rahul Verma", email: "rahul.v@example.com", phone: "+91 98220 10011", status: "converted", priority: "HIGH", source: "referral", budget: 54000000, propertyType: "villa", assignedToId: agent1.id, createdDaysAgo: 35 },
    { name: "Ishita Bose", email: "ishita.b@example.com", phone: "+91 98220 10012", status: "converted", priority: "MEDIUM", source: "website", budget: 12500000, propertyType: "apartment", assignedToId: agent2.id, createdDaysAgo: 42 },
    { name: "Nikhil Rao", email: "nikhil.r@example.com", phone: "+91 98220 10013", status: "lost", priority: "LOW", source: "facebook", budget: 9000000, propertyType: "plot", assignedToId: agent2.id, lostReason: "Budget mismatch", createdDaysAgo: 30 },
    { name: "Tanvi Shah", email: "tanvi.s@example.com", phone: "+91 98220 10014", status: "lost", priority: "MEDIUM", source: "instagram", budget: 11000000, propertyType: "apartment", assignedToId: agent1.id, lostReason: "Went with competitor", createdDaysAgo: 25 },
  ];

  const leads = [];
  for (const l of leadData) {
    const { createdDaysAgo, ...rest } = l;
    const createdAt = daysFromNow(-createdDaysAgo, 9);
    const lead = await prisma.lead.create({ data: { ...rest, orgId: org.id, createdAt } });
    leads.push(lead);
    await prisma.activity.create({
      data: {
        orgId: org.id, leadId: lead.id, type: "SYSTEM", actorId: manager.id,
        payload: { text: "Lead created" }, createdAt,
      },
    });
    if (l.status !== "new") {
      await prisma.activity.create({
        data: {
          orgId: org.id, leadId: lead.id, type: "STATUS_CHANGE", actorId: l.assignedToId,
          payload: { from: "new", to: l.status }, createdAt: daysFromNow(-createdDaysAgo + 1, 12),
        },
      });
    }
  }

  // ----- Site visits -----
  const visitSeed = [
    { lead: leads[6], property: properties[2], assignedToId: agent1.id, scheduledAt: daysFromNow(1, 11), status: "SCHEDULED" as const },
    { lead: leads[7], property: properties[0], assignedToId: agent2.id, scheduledAt: daysFromNow(0, 16), status: "SCHEDULED" as const },
    { lead: leads[8], property: properties[1], assignedToId: agent1.id, scheduledAt: daysFromNow(-5, 15), status: "COMPLETED" as const, outcome: "Very interested, wants a price discussion" },
    { lead: leads[9], property: properties[7], assignedToId: agent2.id, scheduledAt: daysFromNow(-3, 12), status: "COMPLETED" as const, outcome: "Liked the unit, comparing with one other" },
    { lead: leads[10], property: properties[6], assignedToId: agent1.id, scheduledAt: daysFromNow(-20, 11), status: "COMPLETED" as const, outcome: "Booked — token received" },
    { lead: leads[3], property: properties[3], assignedToId: agent2.id, scheduledAt: daysFromNow(2, 10), status: "SCHEDULED" as const },
    { lead: leads[13], property: properties[5], assignedToId: agent1.id, scheduledAt: daysFromNow(-10, 14), status: "NO_SHOW" as const },
  ];
  for (const v of visitSeed) {
    await prisma.siteVisit.create({
      data: {
        orgId: org.id, leadId: v.lead.id, propertyId: v.property.id,
        assignedToId: v.assignedToId, scheduledAt: v.scheduledAt, status: v.status,
        outcome: v.outcome,
      },
    });
    await prisma.activity.create({
      data: {
        orgId: org.id, leadId: v.lead.id, type: "VISIT", actorId: v.assignedToId,
        payload: { propertyTitle: v.property.title, scheduledAt: v.scheduledAt.toISOString(), status: v.status },
      },
    });
  }

  // ----- Tasks -----
  await prisma.task.createMany({
    data: [
      { orgId: org.id, title: "Send brochure to Arjun Mehta", dueAt: daysFromNow(0, 18), assignedToId: agent1.id, linkedType: "lead", linkedId: leads[2].id },
      { orgId: org.id, title: "Call Vikram Singh — overdue follow-up", dueAt: daysFromNow(-1, 10), assignedToId: agent1.id, linkedType: "lead", linkedId: leads[4].id },
      { orgId: org.id, title: "Prepare negotiation sheet for Aditya Joshi", dueAt: daysFromNow(1, 12), assignedToId: agent1.id, linkedType: "lead", linkedId: leads[8].id },
      { orgId: org.id, title: "Confirm site visit with Sneha Kulkarni", dueAt: daysFromNow(1, 9), assignedToId: agent2.id, linkedType: "lead", linkedId: leads[3].id },
      { orgId: org.id, title: "Upload new photos for Riverfront Residences", dueAt: daysFromNow(3, 11), assignedToId: agent2.id, linkedType: "property", linkedId: properties[5].id, status: "DONE" },
    ],
  });

  // ----- Notifications -----
  await prisma.notification.createMany({
    data: [
      { orgId: org.id, recipientId: agent1.id, type: "followup_due", payload: { title: "Follow-up overdue", body: "Vikram Singh's follow-up was due yesterday", href: `/leads/${leads[4].id}` } },
      { orgId: org.id, recipientId: agent1.id, type: "visit_reminder", payload: { title: "Site visit tomorrow", body: "Karan Kapoor — The Crown Penthouse, 11:00", href: "/site-visits" } },
      { orgId: org.id, recipientId: agent2.id, type: "lead_assigned", payload: { title: "New lead assigned", body: "Priya Nair (Instagram) was assigned to you", href: `/leads/${leads[1].id}` } },
      { orgId: org.id, recipientId: manager.id, type: "pipeline", payload: { title: "Negotiation update", body: "2 leads are now in negotiation", href: "/leads?view=board" }, read: true },
    ],
  });

  console.log("Seeded:", {
    org: org.name,
    users: 4,
    properties: properties.length,
    leads: leads.length,
    logins: {
      admin: "admin@horizonrealty.test / admin123",
      manager: "manager@horizonrealty.test / manager123",
      agents: "emily@horizonrealty.test, marcus@horizonrealty.test / agent123",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
