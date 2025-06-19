module.exports = async (db) => {
  await db.query(`
    INSERT INTO agents (name, version, description) VALUES
      ('Zabbix Agent', '6.0', 'Monitoring agent for Zabbix'),
      ('Nagios Agent', '5.8', 'Monitoring agent for Nagios'),
      ('Prometheus Node Exporter', '1.5.0', 'Exporter for Prometheus monitoring'),
      ('Telegraf', '1.29.2', 'Agent for collecting & reporting metrics'),
      ('Datadog Agent', '7.45.0', 'Monitoring agent for Datadog'),
      ('New Relic Infrastructure', '1.36.0', 'Infrastructure monitoring agent'),
      ('Elastic APM Agent', '3.47.0', 'APM agent for Elastic Stack'),
      ('Splunk Universal Forwarder', '9.1.0', 'Log forwarding agent for Splunk'),
      ('Syslog-ng Agent', '4.4.0', 'Syslog agent for log collection'),
      ('Custom Script Agent', '1.0', 'Custom monitoring or automation agent')
    ON CONFLICT (name) DO NOTHING;
  `);
};