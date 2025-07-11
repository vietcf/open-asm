// config/accountOptions.js
const accountOptions = {
  accountTypes: [
    { value: 'OS', label: 'Operating System (OS)' },
    { value: 'APP', label: 'Application (APP)' },
    { value: 'DB', label: 'Database (DB)' }
  ],
  manageTypes: [
    { value: 'SELF', label: 'Self-managed' },
    { value: 'PAM', label: 'Managed by PAM' },
    { value: 'ENVELOPE', label: 'Envelope method' }
  ]
};

export default accountOptions;
