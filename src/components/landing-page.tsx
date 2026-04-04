import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserPlus, SlidersHorizontal, Zap, Check, Search, Clock } from "lucide-react";

function Header() {
  return (
    <header className="w-full py-6 px-8 lg:px-16 flex items-center justify-between">
      <span className="font-bold text-xl tracking-tight">WoningNet DAK</span>
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          Login
        </Link>
        <Link
          href="/register"
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Register
        </Link>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="w-full px-8 lg:px-16 pt-12 pb-32 lg:pt-20 lg:pb-40 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Left — copy */}
        <div className="w-full lg:w-5/12 flex flex-col items-start">
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight mb-6">
            WoningNet DAK
            <br />
            applies to the best
            <br />
            listings for you.
          </h1>
          <p className="text-base text-muted-foreground mb-8 max-w-md leading-relaxed">
            Automate your social housing applications in Almere with intelligent
            preferences. Save time and increase your chances of finding a home.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-3 text-base font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            Start Automating Now
          </Link>
        </div>

        {/* Right — decorative mockup */}
        <div className="w-full lg:w-7/12 relative hidden md:flex justify-end items-start min-h-[480px]">
          <RecentApplicationsMockup />
          <StatusCardMockup />
        </div>
      </div>
    </section>
  );
}

const MOCK_LISTINGS = [
  {
    name: "3-Room Apartment, Almere Buiten",
    price: "€850/month",
    img: "https://res.cloudinary.com/woningnet/image/upload/q_auto/f_auto/c_fill,w_400,h_250/v1775126545/WRB/P/1325/a4ybofmfmsgxg95xgdeo.jpg",
  },
  {
    name: "2-Room Apartment, Almere Stad",
    price: "€720/month",
    img: "https://res.cloudinary.com/woningnet/image/upload/q_auto/f_auto/c_fill,w_400,h_250/v1774858331/WRB/P/1338/exedzztujo8xqgyzc1xk.png",
  },
  {
    name: "3-Room Apartment, Almere Haven",
    price: "€790/month",
    img: "https://res.cloudinary.com/woningnet/image/upload/q_auto/f_auto/c_fill,w_400,h_250/v1774859864/WRB/P/1317/o1fjxz1r3qwk93epgkid.jpg",
  },
  {
    name: "2-Room Apartment, Almere Buiten",
    price: "€680/month",
    img: "https://res.cloudinary.com/woningnet/image/upload/q_auto/f_auto/c_fill,w_400,h_250/v1774865303/WRB/P/1357/onp0aivdqjfxcc8mraur.png",
  },
];

function RecentApplicationsMockup() {
  return (
    <Card className="w-[480px] shadow-xl border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Recent Applications</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {MOCK_LISTINGS.map((listing, i) => (
            <div
              key={i}
              className="rounded-xl border overflow-hidden"
            >
              <div className="h-24 relative">
                <img
                  src={listing.img}
                  alt={listing.name}
                  className="w-full h-full object-cover"
                />
                <Badge variant="success" className="absolute top-2 right-2 text-[10px]">
                  <Check className="h-2.5 w-2.5 mr-0.5" />
                  Applied
                </Badge>
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold leading-tight mb-1">{listing.name}</p>
                <p className="text-xs text-muted-foreground">{listing.price}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const MOCK_EVENTS = [
  {
    time: "Today, 10:30 AM",
    title: "Applied to:",
    detail: "2-Room Apartment, Almere Stad",
    status: "Success",
    statusColor: "text-green-700",
    icon: Check,
  },
  {
    time: "Yesterday, 4:15 PM",
    title: "Preference Updated:",
    detail: "Max Rent €800",
    status: "Saved",
    statusColor: "text-green-700",
    icon: SlidersHorizontal,
  },
  {
    time: "Yesterday, 8:00 AM",
    title: "New Listings Found:",
    detail: "3 Matches",
    status: "Processing",
    statusColor: "text-amber-600",
    icon: Search,
  },
];

function StatusCardMockup() {
  return (
    <Card className="absolute -right-8 lg:-right-4 top-12 w-72 shadow-2xl z-20 border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs">Application Status Card</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {MOCK_EVENTS.map((event, i) => (
          <div
            key={i}
            className={`relative pl-6 pb-4 ${i < MOCK_EVENTS.length - 1 ? "border-l-2 border-border" : "border-l-2 border-transparent"} ml-2.5`}
          >
            <div className="absolute w-5 h-5 bg-accent rounded-full -left-[11px] top-0 flex items-center justify-center">
              <event.icon className="w-2.5 h-2.5 text-primary" />
            </div>
            <p className="text-[10px] text-muted-foreground mb-0.5">{event.time}</p>
            <p className="text-xs font-semibold">
              {event.title}{" "}
              <span className="font-normal text-muted-foreground">{event.detail}</span>
            </p>
            <p className={`text-[10px] ${event.statusColor} flex items-center gap-0.5 mt-0.5 font-medium`}>
              {event.status === "Processing" ? (
                <Clock className="w-2.5 h-2.5" />
              ) : (
                <Check className="w-2.5 h-2.5" />
              )}
              {event.status}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const HOW_IT_WORKS_STEPS = [
  {
    icon: UserPlus,
    title: "1. Connect Account.",
    description: "Securely link your WoningNet profile.",
  },
  {
    icon: SlidersHorizontal,
    title: "2. Set Preferences.",
    description: "Define your ideal home criteria.",
  },
  {
    icon: Zap,
    title: "3. Automate Applications.",
    description: "Let DAK handle the rest.",
  },
];

function HowItWorksSection() {
  return (
    <section className="w-full bg-muted py-16 lg:py-20 px-8 lg:px-16 -mt-16 relative z-0">
      <div className="max-w-5xl mx-auto pt-12 lg:pt-16">
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-12 md:gap-4">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-8 left-[15%] right-[15%] h-0.5 bg-foreground/15 z-0" />

          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <div
              key={i}
              className="flex flex-col items-center text-center relative z-10 w-full md:w-1/3 px-4"
            >
              <div className="w-16 h-16 bg-card border-2 border-foreground/15 rounded-full flex items-center justify-center mb-6 shadow-sm">
                <step.icon className="w-6 h-6 text-foreground/60" />
              </div>
              <h3 className="text-lg font-bold mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function HeroBackground() {
  return (
    <div className="absolute inset-0 hero-bg pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 hero-overlay" />
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="relative">
        <HeroBackground />
        <div className="relative z-10">
          <Header />
          <HeroSection />
        </div>
      </div>
      <main className="flex-grow">
        <HowItWorksSection />
      </main>
    </div>
  );
}
