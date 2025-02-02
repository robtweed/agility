export function load(ctx) {

  let gx=`
<sbadmin-root>

  <span golgi:appendTo="topbarTarget">
    <sbadmin-sidebar-toggle />
    <sbadmin-brand text="Agility" />
  </span>

  <sbadmin-footer-text golgi:appendTo="footerTarget">
    <sbadmin-copyright text="2025 MGateway Ltd" />
  </sbadmin-footer-text>

  <sbadmin-sidebar-menu golgi:appendTo="sidebarTarget">

    <sbadmin-sidebar-menu-item iconName="power" text="Start/Stop Agility" contentPage="status" active="true" />

    <sbadmin-sidebar-nested-menu iconName="activity" text="System">
      <sbadmin-sidebar-menu-item iconName="clipboard" text="Activity Log" contentPage="log" />
      <sbadmin-sidebar-menu-item iconName="battery-charging" text="Current Power Status" contentPage="positionNow" />
      <sbadmin-sidebar-menu-item iconName="list" text="Cheapest Agile Slots" contentPage="slotsNow" />
      <sbadmin-sidebar-menu-item iconName="trending-up" text="Power Usage History" contentPage="solisUseHistory" />
      <sbadmin-sidebar-menu-item iconName="trending-up" text="Average Power Usage Profile" contentPage="solisProfile" />
    </sbadmin-sidebar-nested-menu>

    <sbadmin-sidebar-nested-menu iconName="user-check" text="Manual Control">
      <sbadmin-sidebar-menu-item text="Inverter Charge" contentPage="inverterCharge" />
      <sbadmin-sidebar-menu-item text="Inverter Discharge" contentPage="inverterDischarge" />
      <sbadmin-sidebar-menu-item text="Inverter Grid Power Only" contentPage="inverterGridOnly" />
    </sbadmin-sidebar-nested-menu>

    <sbadmin-sidebar-nested-menu iconName="settings" text="Configuration">
      <sbadmin-sidebar-menu-item text="SolisCloud" contentPage="solis" />
      <sbadmin-sidebar-menu-item text="Octopus" contentPage="octopus"/>
      <sbadmin-sidebar-menu-item text="Battery" contentPage="battery"/>
      <sbadmin-sidebar-sub-menu text="Solcast">
        <sbadmin-sidebar-menu-item text="API Configuration" contentPage="solcast" />
        <sbadmin-sidebar-menu-item text="Adjustment Control" contentPage="solcastAdjustment" />
      </sbadmin-sidebar-sub-menu>
      <sbadmin-sidebar-menu-item text="Operation" contentPage="operation"/>
    </sbadmin-sidebar-nested-menu>

    <sbadmin-sidebar-menu-item iconName="file-plus" text="Update" contentPage="update" />

  </sbadmin-sidebar-menu>



</sbadmin-root>
  `;

  let hooks = {
    'sbadmin-sidebar-menu-item': {
    }
  };

  return {gx, hooks};
};