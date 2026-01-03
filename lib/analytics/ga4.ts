
import { BetaAnalyticsDataClient } from "@google-analytics/data";

const propertyId = process.env.GA_PROPERTY_ID;
const clientEmail = process.env.GA_CLIENT_EMAIL;
const privateKey = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, "\n");

const analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: {
        client_email: clientEmail,
        private_key: privateKey,
    },
});

export async function getGA4Stats() {
    if (!propertyId || !clientEmail || !privateKey) {
        throw new Error("Google Analytics credentials are missing in environment variables.");
    }

    // 1. Get Summary Stats (Last 7 days vs Previous 7 days - simplified)
    const [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [
            {
                startDate: "7daysAgo",
                endDate: "today",
            },
        ],
        dimensions: [
            {
                name: "date",
            },
        ],
        metrics: [
            {
                name: "activeUsers",
            },
            {
                name: "sessions",
            },
            {
                name: "averageSessionDuration",
            },
            {
                name: "screenPageViews",
            },
        ],
    });

    // 2. Get Realtime Users (Anlık)
    const [realtimeResponse] = await analyticsDataClient.runRealtimeReport({
        property: `properties/${propertyId}`,
        metrics: [
            {
                name: "activeUsers",
            },
        ],
    });

    // Process data
    const totalUsers = response.rows?.reduce((acc, row) => acc + parseInt(row.metricValues?.[0].value || "0"), 0) || 0;
    const totalSessions = response.rows?.reduce((acc, row) => acc + parseInt(row.metricValues?.[1].value || "0"), 0) || 0;

    // Calculate Avg Session Duration across all rows
    const totalDuration = response.rows?.reduce((acc, row) => acc + parseFloat(row.metricValues?.[2].value || "0"), 0) || 0;
    const avgDuration = response.rows && response.rows.length > 0 ? totalDuration / response.rows.length : 0;

    const realtimeUsers = realtimeResponse.rows?.[0]?.metricValues?.[0]?.value || "0";

    // Trend data for bars (last 7 days)
    const sortedRows = [...(response.rows || [])].sort((a, b) => (a.dimensionValues?.[0].value || "").localeCompare(b.dimensionValues?.[0].value || ""));
    const trend = sortedRows.map(row => ({
        date: row.dimensionValues?.[0].value,
        count: parseInt(row.metricValues?.[0].value || "0")
    }));

    return {
        realtimeUsers,
        totalUsers,
        totalSessions,
        avgDuration: Math.round(avgDuration),
        trend
    };
}
