// Site configuration utility
// Loads and caches common configuration values from database at startup
import Configuration from '../modules/administrator/configuration.model.js';

const siteConfig = {
  cachedSiteName: 'ASG Project',
  cachedPageSizeOptions: [10, 20, 50],
  cachedDefaultPageSize: 10,
  cachedSessionIdleTimeoutMinutes: 30,
  async initialize() {
    try {
      // Load site name
      const siteConfigRow = await Configuration.findByKey('site_name');
      this.cachedSiteName = siteConfigRow ? siteConfigRow.value : 'ASG Project';
      console.log(`📝 Site name loaded: ${this.cachedSiteName}`);

      // Load page size options
      const pageSizeConfig = await Configuration.findByKey('page_size');
      if (pageSizeConfig && typeof pageSizeConfig.value === 'string') {
        this.cachedPageSizeOptions = pageSizeConfig.value.split(',')
          .map(s => parseInt(s.trim(), 10))
          .filter(Boolean);
        this.cachedDefaultPageSize = this.cachedPageSizeOptions[0] || 10;
        console.log(`📝 Page size options loaded: ${this.cachedPageSizeOptions.join(', ')}`);
      }

      // Load session idle timeout (minutes); 0 disables auto-expiry
      const idleTimeoutConfig = await Configuration.findByKey('session_idle_timeout_minutes');
      if (idleTimeoutConfig && /^[0-9]+$/.test(idleTimeoutConfig.value)) {
        this.cachedSessionIdleTimeoutMinutes = parseInt(idleTimeoutConfig.value, 10);
        console.log(`📝 Session idle timeout loaded: ${this.cachedSessionIdleTimeoutMinutes} minute(s)`);
      }
    } catch (err) {
      console.warn('⚠️ Failed to load site configuration from database, using defaults:', err.message);
      this.cachedSiteName = 'ASG Project';
      this.cachedPageSizeOptions = [10, 20, 50];
      this.cachedDefaultPageSize = 10;
      this.cachedSessionIdleTimeoutMinutes = 30;
    }
  },
  getSiteName() {
    return this.cachedSiteName;
  },
  getPageSizeOptions() {
    return this.cachedPageSizeOptions;
  },
  getDefaultPageSize() {
    return this.cachedDefaultPageSize;
  },
  getSessionIdleTimeoutMinutes() {
    return this.cachedSessionIdleTimeoutMinutes;
  }
};

export { siteConfig };
