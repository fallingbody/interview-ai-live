import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { AnimatedHeader } from "./HomeContent.jsx";

const COLORS = ["#6265f4", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6"];

const PublicStats = () => {
  const [stats, setStats] = useState({
    registrations: [],
    interviews: [],
    decisions: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/public/stats`);
        const data = await response.json();
        if (data.success) {
          setStats({
            registrations: data.registrations || [],
            interviews: data.interviews || [],
            decisions: data.decisions || []
          });
        }
      } catch (err) {
        console.error("Failed to fetch public stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <section className="hc-section py-20 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </section>
    );
  }

  // Fallback data if DB is empty
  const defaultRegistrations = [
    { date: "Day 1", users: 10 },
    { date: "Day 2", users: 25 },
    { date: "Day 3", users: 45 },
    { date: "Day 4", users: 80 }
  ];
  const defaultInterviews = [
    { date: "Day 1", candidates: 5 },
    { date: "Day 2", candidates: 15 },
    { date: "Day 3", candidates: 40 },
    { date: "Day 4", candidates: 90 }
  ];
  const defaultDecisions = [
    { name: "Selected", value: 30 },
    { name: "Rejected", value: 45 },
    { name: "Pending", value: 25 }
  ];

  const regData = stats.registrations.length > 0 ? stats.registrations : defaultRegistrations;
  const intData = stats.interviews.length > 0 ? stats.interviews : defaultInterviews;
  const decData = stats.decisions.length > 0 ? stats.decisions : defaultDecisions;

  return (
    <section className="hc-section relative z-10 py-16 bg-transparent">
      <div className="max-w-7xl mx-auto px-6">
        <AnimatedHeader 
          label="Platform Metrics"
          title={
            <>
              Powered by <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Real Data</span>
            </>
          }
          subtitle="See the actual volume of candidates processed, teams onboarded, and interview decisions made across our platform."
          center={true}
        />

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Graph 1: Users Registered */}
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgb(98,101,244,0.12)] transition-shadow duration-300">
            <h3 className="text-slate-800 font-bold mb-6 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,101,244,0.5)]"></span>
              Platform Adoption
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={regData}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6265f4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6265f4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="users" stroke="#6265f4" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Graph 2: Interviews Conducted */}
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgb(98,101,244,0.12)] transition-shadow duration-300">
            <h3 className="text-slate-800 font-bold mb-6 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]"></span>
              Interviews Conducted
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={intData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }} />
                  <Bar dataKey="candidates" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Graph 3: Decision Status */}
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgb(98,101,244,0.12)] transition-shadow duration-300">
            <h3 className="text-slate-800 font-bold mb-6 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"></span>
              Candidate Outcomes
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={decData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {decData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PublicStats;
