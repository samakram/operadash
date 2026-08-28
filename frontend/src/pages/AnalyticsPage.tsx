import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DollarSign, Building2, Users, Blocks } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useToast } from "@/components/Common/Toast";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";

interface GrowthPoint {
  date: string;
  count: number;
}

interface PlatformAnalytics {
  totalRevenue: number;
  activeTenants: number;
  totalTenants: number;
  totalUsers: number;
  inactiveTenants: number;
  moduleUsage: Record<string, number>;
  tenantGrowth: GrowthPoint[];
  userGrowth: GrowthPoint[];
}

// Validated against the aurora dark surface (#0f172a) — see dataviz skill categorical check.
const MODULE_COLORS: Record<string, string> = {
  hotel: "#3987e5",
  student: "#d95926",
  patient: "#199e70",
  restaurant: "#c98500",
};
const SEQUENTIAL_BLUE = "#3987e5";

const chartTickStyle = { fill: "#c3c2b7", fontSize: 12 };

function KpiCard({ icon: Icon, label, value, sub }: { icon: typeof DollarSign; label: string; value: string; sub?: string }) {
  return (
    <GlassCard className="flex items-center gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aurora-gradient">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-aurora-text/50">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-xs text-aurora-text/50">{sub}</p>}
      </div>
    </GlassCard>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card !p-2.5 text-xs">
      <p className="mb-1 text-aurora-text/60">{formatDate(label)}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-semibold">
          {p.value}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { show } = useToast();
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get<PlatformAnalytics>("/tenants/analytics/platform");
      setData(data);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to load analytics"), "error");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading || !data) return <LoadingSpinner fullscreen />;

  const moduleData = Object.entries(MODULE_COLORS).map(([name, color]) => ({
    name: titleCase(name),
    tenants: data.moduleUsage[name] ?? 0,
    color,
  }));

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <div>
        <h2>Analytics</h2>
        <p className="mt-1 text-sm text-aurora-text/60">Platform-wide metrics across every tenant</p>
      </div>

      <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={DollarSign} label="Total Revenue (MRR)" value={formatCurrency(data.totalRevenue)} />
        <KpiCard icon={Building2} label="Active Tenants" value={String(data.activeTenants)} sub={`${data.totalTenants} total`} />
        <KpiCard icon={Users} label="Total Users" value={String(data.totalUsers)} />
        <KpiCard icon={Blocks} label="Module Enrollments" value={String(Object.values(data.moduleUsage).reduce((a, b) => a + b, 0))} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <GlassCard>
          <h3 className="mb-4">Tenant Growth (30 days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.tenantGrowth} margin={{ left: -20 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="date" tickFormatter={(d: string) => formatDate(d)} tick={chartTickStyle} axisLine={false} tickLine={false} minTickGap={40} />
              <YAxis tick={chartTickStyle} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="count" name="Tenants" stroke={SEQUENTIAL_BLUE} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard>
          <h3 className="mb-4">User Growth (30 days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.userGrowth} margin={{ left: -20 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="date" tickFormatter={(d: string) => formatDate(d)} tick={chartTickStyle} axisLine={false} tickLine={false} minTickGap={40} />
              <YAxis tick={chartTickStyle} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="count" name="Users" stroke={SEQUENTIAL_BLUE} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="mb-4">Module Usage</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={moduleData} margin={{ left: -20 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="name" tick={chartTickStyle} axisLine={false} tickLine={false} />
            <YAxis tick={chartTickStyle} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
            <Bar dataKey="tenants" name="Tenants using" radius={[4, 4, 0, 0]}>
              {moduleData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-aurora-text/60">
          {moduleData.map((m) => (
            <span key={m.name} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
              {m.name}
            </span>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
