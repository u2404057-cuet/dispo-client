"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Server, TagDollar, ChartLine, SealPercent } from "@gravity-ui/icons";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function StatCard({ icon: Icon, label, value, loading }) {
  return (
    <div className="flex items-center gap-4 rounded-[1.5rem] bg-surface-container-low p-5 shadow-[8px_8px_20px_rgba(184,196,214,0.55),-8px_-8px_20px_rgba(255,255,255,0.9)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface shadow-[inset_2px_2px_5px_rgba(184,196,214,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{label}</p>
        <p className="font-headline-lg text-headline-lg text-on-surface">
          {loading ? "…" : value}
        </p>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-[1.5rem] bg-surface-container-low p-5 shadow-[8px_8px_20px_rgba(184,196,214,0.55),-8px_-8px_20px_rgba(255,255,255,0.9)]">
      <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChartState({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-6 w-6 text-tertiary mb-2" />
      <p className="font-body-sm text-body-sm text-on-surface-variant">{message}</p>
    </div>
  );
}

export default function OwnerDashboardPage() {
  const [products, setProducts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [productsRes, devicesRes, ordersRes] = await Promise.all([
          fetch("/api/proxy/products"),
          fetch("/api/proxy/devices"),
          fetch("/api/proxy/orders"),
        ]);
        setProducts(await productsRes.json());
        setDevices(await devicesRes.json());
        setOrders(await ordersRes.json());
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // GET /api/products is intentionally public/unfiltered (customers browsing
  // /shop need every owner's products). Every stat/chart below that's based
  // on products must first be scoped to devices this account actually owns
  // (or every device, correctly, if this account is admin) — otherwise the
  // dashboard shows the whole system's numbers, not this owner's business.
  const myProducts = useMemo(() => {
    if (!Array.isArray(products) || !Array.isArray(devices)) return [];
    const ownedDeviceIds = new Set(devices.map((d) => d._id));
    return products.filter((p) => ownedDeviceIds.has(p.deviceId));
  }, [products, devices]);

  const totalStock = useMemo(
    () => myProducts.reduce((sum, p) => sum + (p.stock || 0), 0),
    [myProducts]
  );

  const totalRevenue = useMemo(
    () => (Array.isArray(orders) ? orders.reduce((sum, o) => sum + (o.total || 0), 0) : 0),
    [orders]
  );

  const stockByProduct = useMemo(
    () => myProducts.map((p) => ({ name: p.name, stock: p.stock || 0 })).slice(0, 12),
    [myProducts]
  );

  const productsByDevice = useMemo(() => {
    if (!Array.isArray(devices)) return [];
    const deviceNameById = Object.fromEntries(devices.map((d) => [d._id, d.name]));
    const counts = {};
    myProducts.forEach((p) => {
      const name = deviceNameById[p.deviceId];
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [myProducts, devices]);

  // Revenue grouped by calendar day, oldest first — a real time series
  // once more than one day of orders exists.
  const revenueOverTime = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    const byDay = {};
    orders.forEach((o) => {
      const day = new Date(o.createdAt).toLocaleDateString("en-CA"); // YYYY-MM-DD, sorts correctly as a string
      byDay[day] = (byDay[day] || 0) + (o.total || 0);
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, revenue]) => ({ day, revenue }));
  }, [orders]);

  // Aggregate quantity sold per product across every order's line items
  // (orders are already correctly scoped server-side to this owner's
  // devices, so no extra filtering needed here).
  const topSelling = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    const soldByName = {};
    orders.forEach((o) => {
      (o.items || []).forEach((item) => {
        soldByName[item.name] = (soldByName[item.name] || 0) + item.qty;
      });
    });
    return Object.entries(soldByName)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }, [orders]);

  return (
    <main className="w-full min-h-screen py-10 px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-1">Dashboard</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-8">
          A quick look at your kiosk business.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-8">
          <StatCard icon={Server} label="Devices" value={devices.length} loading={loading} />
          <StatCard icon={Box} label="Products" value={myProducts.length} loading={loading} />
          <StatCard icon={TagDollar} label="Units in stock" value={totalStock} loading={loading} />
          <StatCard icon={ChartLine} label="Revenue" value={`৳${totalRevenue}`} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title="Stock by product">
            {loading ? (
              <div className="h-64 animate-pulse rounded-xl bg-surface-container" />
            ) : stockByProduct.length === 0 ? (
              <EmptyChartState icon={Box} message="Add products to see this chart." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stockByProduct} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e3e8" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="stock" fill="#ff5d00" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Products by device">
            {loading ? (
              <div className="h-64 animate-pulse rounded-xl bg-surface-container" />
            ) : productsByDevice.length === 0 ? (
              <EmptyChartState icon={Server} message="Add devices and products to see this chart." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={productsByDevice} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e3e8" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#595f68" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Revenue over time">
            {loading ? (
              <div className="h-64 animate-pulse rounded-xl bg-surface-container" />
            ) : revenueOverTime.length === 0 ? (
              <EmptyChartState icon={ChartLine} message="No sales yet — this fills in as orders come through /shop/checkout." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={revenueOverTime} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e3e8" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#ff5d00" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Top-selling products">
            {loading ? (
              <div className="h-64 animate-pulse rounded-xl bg-surface-container" />
            ) : topSelling.length === 0 ? (
              <EmptyChartState icon={SealPercent} message="No sales yet — this fills in as orders come through /shop/checkout." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topSelling} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e3e8" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="qty" fill="#ff5d00" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </div>
    </main>
  );
}
