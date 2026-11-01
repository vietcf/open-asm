// Small lookup lists rendered with a page (no AJAX): tags, units and the catalogs.
// Large tables (systems, contacts, servers, IPs, domains) keep their AJAX pickers.
//   res.render(view, { ...(await pageOptions('tags', 'units')) })  -> { tagOptions, unitOptions }
import Tag from '../modules/organize/tag.model.js';
import Unit from '../modules/organize/unit.model.js';
import Platform from '../modules/device/platform.model.js';
import DeviceType from '../modules/device/device-type.model.js';
import Service from '../modules/server/service.model.js';
import Agent from '../modules/server/agent.model.js';

const SOURCES = {
  tags: ['tagOptions', () => Tag.options()],
  units: ['unitOptions', () => Unit.options()],
  platforms: ['platformOptions', () => Platform.options()],
  deviceTypes: ['deviceTypeOptions', () => DeviceType.options()],
  services: ['serviceOptions', () => Service.options()],
  agents: ['agentOptions', () => Agent.options()],
};

export async function pageOptions(...names) {
  const entries = await Promise.all(names.map(async (name) => {
    const [key, load] = SOURCES[name];
    return [key, await load()];
  }));
  return Object.fromEntries(entries);
}
