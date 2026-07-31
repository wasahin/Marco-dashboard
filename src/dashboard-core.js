class DashboardCore {
    constructor(dataUrl = 'data/market-data.json') {
        this.dataUrl = dataUrl;
        this.data = null;
    }

    async loadData() {
        try {
            const response = await fetch(this.dataUrl);
            this.data = await response.json();
            return this.data;
        } catch (error) {
            console.error('Failed to load market data:', error);
            return null;
        }
    }

    getMetric(key) { return this.data?.metrics?.[key] || null; }
    getStructural(key) { return this.data?.structural?.[key] || null; }
    getRegime() { return this.data?.regime || null; }
}

export default DashboardCore;
