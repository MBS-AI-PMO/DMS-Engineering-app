export const guidelinesData = [
  {
    id: 'anodizing',
    title: 'Anodizing',
    content: 'Anodizing is an electrochemical process that converts the metal surface into a decorative, durable, corrosion-resistant, anodic oxide finish. We offer Type II and Type III (Hardcoat) anodizing in multiple colors for aluminum parts.',
    tables: [
      {
        material: '5052 Aluminum',
        rows: [
          { thickness: '.040"', min: 'N/A', max: 'N/A' },
          { thickness: '.063"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.080"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.090"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.100"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.125"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.187"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.250"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.313"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.375"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.500"', min: '1" x 3"', max: '23" x 23"' }
        ]
      },
      {
        material: '6061 Aluminum',
        rows: [
          { thickness: '.040"', min: 'N/A', max: 'N/A' },
          { thickness: '.063"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.080"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.100"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.125"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.187"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.250"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.313"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.375"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.500"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.625"', min: '3" x 3"', max: '23" x 23"' },
          { thickness: '.750"', min: '3" x 3"', max: '23" x 23"' }
        ]
      },
      {
        material: '7075 Aluminum',
        rows: [
          { thickness: '.125"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.190"', min: '1" x 3"', max: '23" x 23"' },
          { thickness: '.250"', min: '1" x 3"', max: '23" x 23"' }
        ]
      }
    ]
  },
  {
    id: 'bending',
    title: 'Bending',
    content: 'We use CNC press brakes for air bending sheet metal. Each material and thickness has a specific bend radius and minimum flange length requirement.',
    tables: [
      {
        material: '4130 Chromoly',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Radius @ 90°', 'Max Length', 'Flange (Before)', 'Flange (After)'],
        rows: [
          { t: '.050"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.050"', maxL: '44"', fBefore: '.255"', fAfter: '.302"' },
          { t: '.063"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.050"', maxL: '44"', fBefore: '.255"', fAfter: '.308"' },
          { t: '.125"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.090"', maxL: '30"', fBefore: '.620"', fAfter: '.723"' },
          { t: '.190"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.125"', maxL: '18"', fBefore: '.620"', fAfter: '.782"' },
          { t: '.250"', minF: '.375" x 2.5"', maxF: '30" x 44"', radius: '.170"', maxL: '16"', fBefore: '1.150"', fAfter: '1.367"' }
        ]
      },
      {
        material: '5052 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Radius @ 90°', 'Max Length', 'Flange (Before)', 'Flange (After)'],
        rows: [
          { t: '.040"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.024"', maxL: '44"', fBefore: '.255"', fAfter: '.286"' },
          { t: '.063"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.035"', maxL: '44"', fBefore: '.255"', fAfter: '.303"' },
          { t: '.080"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.045"', maxL: '44"', fBefore: '.255"', fAfter: '.313"' },
          { t: '.090"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.032"', maxL: '44"', fBefore: '.255"', fAfter: '.326"' },
          { t: '.100"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.125"', maxL: '44"', fBefore: '.368"', fAfter: '.463"' },
          { t: '.125"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.125"', maxL: '44"', fBefore: '.368"', fAfter: '.476"' },
          { t: '.187"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.250"', maxL: '44"', fBefore: '.620"', fAfter: '.798"' },
          { t: '.250"', minF: '.375" x 2.5"', maxF: '30" x 44"', radius: '.250"', maxL: '44"', fBefore: '1.150"', fAfter: '1.371"' },
          { t: '.375"', minF: 'N/A', maxF: 'N/A', radius: 'N/A', maxL: 'N/A', fBefore: 'N/A', fAfter: 'N/A' },
          { t: '.500"', minF: 'N/A', maxF: 'N/A', radius: 'N/A', maxL: 'N/A', fBefore: 'N/A', fAfter: 'N/A' }
        ]
      },
      {
        material: 'Brass',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Radius @ 90°', 'Max Length', 'Flange (Before)', 'Flange (After)'],
        rows: [
          { t: '.040"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.040"', maxL: '44"', fBefore: '.255"', fAfter: '.292"' },
          { t: '.063"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.040"', maxL: '44"', fBefore: '.255"', fAfter: '.308"' },
          { t: '.125"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.060"', maxL: '33"', fBefore: '.368"', fAfter: '.471"' },
          { t: '.187"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.095"', maxL: '18"', fBefore: '.620"', fAfter: '.782"' },
          { t: '.250"', minF: '.375" x 2.5"', maxF: '30" x 44"', radius: '.130"', maxL: '25"', fBefore: '1.150"', fAfter: '1.362"' }
        ]
      },
      {
        material: 'Copper',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Radius @ 90°', 'Max Length', 'Flange (Before)', 'Flange (After)'],
        rows: [
          { t: '.040"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.052"', maxL: '44"', fBefore: '.255"', fAfter: '.296"' },
          { t: '.063"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.024"', maxL: '44"', fBefore: '.255"', fAfter: '.305"' },
          { t: '.125"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.050"', maxL: '44"', fBefore: '.368"', fAfter: '.471"' },
          { t: '.187"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.118"', maxL: '44"', fBefore: '.620"', fAfter: '.780"' },
          { t: '.250"', minF: '.375" x 2.5"', maxF: '30" x 44"', radius: '.140"', maxL: '44"', fBefore: '1.150"', fAfter: '1.365"' }
        ]
      },
      {
        material: 'G90 Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Radius @ 90°', 'Max Length', 'Flange (Before)', 'Flange (After)'],
        rows: [
          { t: '.030"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.045"', maxL: '44"', fBefore: '.255"', fAfter: '.286"' },
          { t: '.048"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.045"', maxL: '44"', fBefore: '.255"', fAfter: '.298"' },
          { t: '.059"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.063"', maxL: '44"', fBefore: '.255"', fAfter: '.309"' },
          { t: '.074"', minF: '.375" x 2.5"', maxF: '30" x 44"', radius: '.063"', maxL: '44"', fBefore: '.255"', fAfter: '.320"' }
        ]
      },
      {
        material: 'Cold Rolled Steel (1008)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Radius @ 90°', 'Max Length', 'Flange (Before)', 'Flange (After)'],
        rows: [
          { t: '.030"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.045"', maxL: '44"', fBefore: '.255"', fAfter: '.286"' },
          { t: '.048"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.045"', maxL: '44"', fBefore: '.255"', fAfter: '.298"' },
          { t: '.059"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.063"', maxL: '44"', fBefore: '.255"', fAfter: '.309"' },
          { t: '.074"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.063"', maxL: '44"', fBefore: '.255"', fAfter: '.320"' },
          { t: '.104"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.063"', maxL: '44"', fBefore: '.368"', fAfter: '.459"' },
          { t: '.119"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.063"', maxL: '44"', fBefore: '.368"', fAfter: '.466"' },
          { t: '.135"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.100"', maxL: '44"', fBefore: '.620"', fAfter: '.742"' }
        ]
      },
      {
        material: 'HRP&O Steel (A36/A1018)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Radius @ 90°', 'Max Length', 'Flange (Before)', 'Flange (After)'],
        rows: [
          { t: '.187"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.125"', maxL: '22"', fBefore: '.620"', fAfter: '.781"' },
          { t: '.250"', minF: '.375" x 2.5"', maxF: '30" x 44"', radius: '.150"', maxL: '20"', fBefore: '1.150"', fAfter: '1.361"' }
        ]
      },
      {
        material: 'Hot Rolled Steel (A36)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Radius @ 90°', 'Max Length', 'Flange (Before)', 'Flange (After)'],
        rows: [
          { t: '.313"', minF: 'N/A', maxF: 'N/A', radius: 'N/A', maxL: 'N/A', fBefore: 'N/A', fAfter: 'N/A' },
          { t: '.375"', minF: 'N/A', maxF: 'N/A', radius: 'N/A', maxL: 'N/A', fBefore: 'N/A', fAfter: 'N/A' },
          { t: '.500"', minF: 'N/A', maxF: 'N/A', radius: 'N/A', maxL: 'N/A', fBefore: 'N/A', fAfter: 'N/A' }
        ]
      },
      {
        material: '304 Stainless Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Radius @ 90°', 'Max Length', 'Flange (Before)', 'Flange (After)'],
        rows: [
          { t: '.030"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.080"', maxL: '44"', fBefore: '.255"', fAfter: '.294"' },
          { t: '.048"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.080"', maxL: '44"', fBefore: '.255"', fAfter: '.307"' },
          { t: '.060"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.070"', maxL: '44"', fBefore: '.255"', fAfter: '.314"' },
          { t: '.074"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.075"', maxL: '44"', fBefore: '.255"', fAfter: '.324"' },
          { t: '.100"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.187"', maxL: '35"', fBefore: '.620"', fAfter: '.732"' },
          { t: '.125"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.150"', maxL: '40"', fBefore: '.620"', fAfter: '.740"' },
          { t: '.187"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.130"', maxL: '36"', fBefore: '.620"', fAfter: '.784"' },
          { t: '.250"', minF: '.375" x 2.5"', maxF: '30" x 44"', radius: '.225"', maxL: '18"', fBefore: '1.150"', fAfter: '1.381"' }
        ]
      },
      {
        material: '316 Stainless Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Radius @ 90°', 'Max Length', 'Flange (Before)', 'Flange (After)'],
        rows: [
          { t: '.060"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.070"', maxL: '44"', fBefore: '.255"', fAfter: '.314"' },
          { t: '.125"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.150"', maxL: '18"', fBefore: '.620"', fAfter: '.740"' },
          { t: '.187"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '.130"', maxL: '18"', fBefore: '.620"', fAfter: '.784"' },
          { t: '.250"', minF: '.375" x 2.5"', maxF: '30" x 44"', radius: '.225"', maxL: '18"', fBefore: '1.150"', fAfter: '1.381"' }
        ]
      },
      {
        material: 'Titanium Grade 2',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Radius @ 90°', 'Max Length', 'Flange (Before)', 'Flange (After)'],
        rows: [
          { t: '.040"', minF: '.375" x 1.5"', maxF: '30" x 44"', radius: '0.045"', maxL: '44"', fBefore: '.255"', fAfter: '.295"' }
        ]
      }
    ]
  },
  {
    id: 'countersinking',
    title: 'Countersinking',
    content: 'Countersinking allows screws to sit flush with the surface of the part. We offer standard angles for various fastener sizes.',
    tables: [
      {
        material: '5052 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Min Minor', 'Max Major'],
        rows: [
          { t: '.040"', minF: 'N/A', maxF: 'N/A', minM: 'N/A', maxM: 'N/A' },
          { t: '.063"', minF: 'N/A', maxF: 'N/A', minM: 'N/A', maxM: 'N/A' },
          { t: '.080"', minF: 'N/A', maxF: 'N/A', minM: 'N/A', maxM: 'N/A' },
          { t: '.090"', minF: 'N/A', maxF: 'N/A', minM: 'N/A', maxM: 'N/A' },
          { t: '.100"', minF: 'N/A', maxF: 'N/A', minM: 'N/A', maxM: 'N/A' },
          { t: '.125"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.099"', maxM: '.427"' },
          { t: '.187"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.099"', maxM: '.531"' },
          { t: '.250"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.099"', maxM: '.656"' },
          { t: '.313"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.130"', maxM: '.656"' },
          { t: '.375"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.130"', maxM: '.656"' },
          { t: '.500"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.193"', maxM: '.656"' }
        ]
      },
      {
        material: '6061 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Min Minor', 'Max Major'],
        rows: [
          { t: '.040"', minF: 'N/A', maxF: 'N/A', minM: 'N/A', maxM: 'N/A' },
          { t: '.063"', minF: 'N/A', maxF: 'N/A', minM: 'N/A', maxM: 'N/A' },
          { t: '.080"', minF: 'N/A', maxF: 'N/A', minM: 'N/A', maxM: 'N/A' },
          { t: '.125"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.099"', maxM: '.472"' },
          { t: '.187"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.099"', maxM: '.531"' },
          { t: '.250"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.099"', maxM: '.531"' },
          { t: '.313"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.099"', maxM: '.656"' },
          { t: '.375"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.130"', maxM: '.656"' },
          { t: '.500"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.193"', maxM: '.656"' },
          { t: '.625"', minF: '3" x 4"', maxF: '14" x 46"', minM: '.193"', maxM: '.656"' },
          { t: '.750"', minF: '3" x 4"', maxF: '14" x 46"', minM: '.255"', maxM: '.656"' }
        ]
      },
      {
        material: '7075 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Min Minor', 'Max Major'],
        rows: [
          { t: '.125"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.130"', maxM: '.472"' },
          { t: '.190"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.099"', maxM: '.531"' },
          { t: '.250"', minF: '1" x 4"', maxF: '14" x 46"', minM: '.099"', maxM: '.656"' }
        ]
      }
    ]
  },
  {
    id: 'deburring',
    title: 'Deburring',
    content: 'Linear deburring removes sharp edges and burrs left by the laser cutting process, providing a safer handleable part.',
    tables: [
      {
        material: '5052 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.040"', minF: 'N/A', maxF: 'N/A' },
          { t: '.063"', minF: '1" x 5"', maxF: '24" x 46"' },
          { t: '.080"', minF: '1" x 5"', maxF: '24" x 46"' },
          { t: '.090"', minF: '1" x 5"', maxF: '24" x 46"' },
          { t: '.100"', minF: '1" x 5"', maxF: '24" x 46"' },
          { t: '.125"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.187"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.250"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.313"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.375"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.500"', minF: '1" x 3"', maxF: '24" x 46"' }
        ]
      },
      {
        material: '6061 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.040"', minF: 'N/A', maxF: 'N/A' },
          { t: '.063"', minF: '1" x 5"', maxF: '24" x 46"' },
          { t: '.080"', minF: '1" x 5"', maxF: '24" x 46"' },
          { t: '.125"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.187"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.250"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.313"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.375"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.500"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.625"', minF: '3" x 3"', maxF: '24" x 46"' },
          { t: '.750"', minF: '3" x 3"', maxF: '24" x 46"' }
        ]
      },
      {
        material: '7075 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.125"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.190"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.250"', minF: '1" x 3"', maxF: '24" x 46"' }
        ]
      },
      {
        material: 'Brass',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.040"', minF: 'N/A', maxF: 'N/A' },
          { t: '.063"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.125"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.187"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.250"', minF: '1" x 3"', maxF: '24" x 46"' }
        ]
      },
      {
        material: 'Copper',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.040"', minF: 'N/A', maxF: 'N/A' },
          { t: '.063"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.125"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.187"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.250"', minF: '1" x 3"', maxF: '24" x 46"' }
        ]
      },
      {
        material: '304 Stainless Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.030"', minF: 'N/A', maxF: 'N/A' },
          { t: '.048"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.060"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.074"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.100"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.125"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.187"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.250"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.375"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.500"', minF: '1" x 3"', maxF: '24" x 46"' }
        ]
      },
      {
        material: '316 Stainless Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.063"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.125"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.250"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.375"', minF: '1" x 3"', maxF: '24" x 46"' }
        ]
      },
      {
        material: 'Titanium Grade 5',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.040"', minF: 'N/A', maxF: 'N/A' },
          { t: '.063"', minF: '1" x 5"', maxF: '24" x 46"' },
          { t: '.125"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.187"', minF: '1" x 3"', maxF: '24" x 46"' },
          { t: '.250"', minF: '1" x 3"', maxF: '24" x 46"' }
        ]
      }
    ]
  },
  {
    id: 'dimple-forming',
    title: 'Dimple Forming',
    content: 'Dimple forming creates a recessed area around a hole, often used to accommodate screw heads in thin materials where countersinking is not possible.',
    tables: [
      {
        material: '2024 T3 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Min Dimple', 'Max Dimple'],
        rows: [
          { t: '.025"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '3.00"' }
        ]
      },
      {
        material: '5052 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Min Dimple', 'Max Dimple'],
        rows: [
          { t: '.040"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '3.00"' },
          { t: '.063"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '3.00"' },
          { t: '.080"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.750"', maxD: '3.00"' },
          { t: '.090"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '1.000"', maxD: '3.00"' },
          { t: '.100"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '1.000"', maxD: '3.00"' },
          { t: '.125"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '1.000"', maxD: '3.00"' },
          { t: '.187"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' },
          { t: '.250"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' },
          { t: '.313"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' },
          { t: '.375"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' },
          { t: '.500"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' }
        ]
      },
      {
        material: '6061 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Min Dimple', 'Max Dimple'],
        rows: [
          { t: '.040"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '2.50"' },
          { t: '.063"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '3.00"' },
          { t: '.080"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '1.00"', maxD: '3.000"' },
          { t: '.100"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '1.00"', maxD: '3.000"' },
          { t: '.125"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '1.25"', maxD: '3.000"' },
          { t: '.250"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' },
          { t: '.375"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' },
          { t: '.500"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' }
        ]
      },
      {
        material: 'G90 Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Min Dimple', 'Max Dimple'],
        rows: [
          { t: '.030"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '3.000"' },
          { t: '.036"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '3.000"' },
          { t: '.048"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '3.000"' },
          { t: '.059"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '3.000"' },
          { t: '.075"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '3.000"' }
        ]
      },
      {
        material: 'Cold Rolled Steel (1008)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Min Dimple', 'Max Dimple'],
        rows: [
          { t: '.030"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '3.000"' },
          { t: '.048"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '3.000"' },
          { t: '.059"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '3.000"' },
          { t: '.074"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '1.000"', maxD: '3.000"' },
          { t: '.104"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '1.250"', maxD: '3.000"' },
          { t: '.119"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '1.250"', maxD: '3.000"' },
          { t: '.135"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' }
        ]
      },
      {
        material: 'HRP&O Steel (A36/A1018)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Min Dimple', 'Max Dimple'],
        rows: [
          { t: '.187"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' },
          { t: '.250"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' }
        ]
      },
      {
        material: 'Hot Rolled Steel (A36)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Min Dimple', 'Max Dimple'],
        rows: [
          { t: '.313"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' },
          { t: '.375"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' },
          { t: '.500"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' }
        ]
      },
      {
        material: '304 Stainless Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Min Dimple', 'Max Dimple'],
        rows: [
          { t: '.030"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '3.000"' },
          { t: '.048"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.500"', maxD: '3.000"' },
          { t: '.060"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.750"', maxD: '3.000"' },
          { t: '.074"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '1.000"', maxD: '3.000"' },
          { t: '.100"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '1.250"', maxD: '3.000"' },
          { t: '.125"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '1.250"', maxD: '3.000"' },
          { t: '.187"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' },
          { t: '.250"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' },
          { t: '.375"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' },
          { t: '.500"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' }
        ]
      },
      {
        material: '316 Stainless Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Min Dimple', 'Max Dimple'],
        rows: [
          { t: '.060"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '.750"', maxD: '3.000"' },
          { t: '.125"', minF: '1.2" x 5.2"', maxF: '26" x 56"', minD: '1.250"', maxD: '3.000"' },
          { t: '.187"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' },
          { t: '.250"', minF: 'N/A', maxF: 'N/A', minD: 'N/A', maxD: 'N/A' }
        ]
      }
    ]
  },
  {
    id: 'hardware',
    title: 'Hardware',
    content: 'We install a wide range of self-clinching fasteners, including PEM® studs, standoffs, and nuts.',
    requirements: [
      'Holes must be sized precisely for the fastener type.',
      'Minimum distance from edges and bends is required.',
      'Choose hardware based on your material type and thickness.',
      'Hardware is usually installed before surface finishing.'
    ],
    tables: [
      {
        material: '5052 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Max 4-Sided Flange'],
        rows: [
          { t: '.040"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.063"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.080"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.090"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.100"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.125"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.187"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.250"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '.3"' },
          { t: '.313"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.375"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.500"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' }
        ]
      },
      {
        material: '6061 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Max 4-Sided Flange'],
        rows: [
          { t: '.040"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.063"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.080"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.100"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.125"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.187"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.250"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.313"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.375"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.500"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' }
        ]
      },
      {
        material: '7075 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Max 4-Sided Flange'],
        rows: [
          { t: '.125"', minF: '1" x 5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.190"', minF: '1" x 5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.250"', minF: '1" x 5"', maxF: '36" x 46"', maxH: 'N/A' }
        ]
      },
      {
        material: 'G90 Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Max 4-Sided Flange'],
        rows: [
          { t: '.030"', minF: 'N/A', maxF: 'N/A', maxH: 'N/A' },
          { t: '.036"', minF: 'N/A', maxF: 'N/A', maxH: 'N/A' },
          { t: '.048"', minF: '1" x 5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.059"', minF: '1" x 5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.074"', minF: '1" x 5"', maxF: '36" x 46"', maxH: '3"' }
        ]
      },
      {
        material: 'Cold Rolled Steel (1008)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Max 4-Sided Flange'],
        rows: [
          { t: '.030"', minF: 'N/A', maxF: 'N/A', maxH: 'N/A' },
          { t: '.048"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.059"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.074"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.104"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.119"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.135"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' }
        ]
      },
      {
        material: 'HRP&O Steel (A36/A1018)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Max 4-Sided Flange'],
        rows: [
          { t: '.187"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.250"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' }
        ]
      },
      {
        material: 'Hot Rolled Steel (A36)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Max 4-Sided Flange'],
        rows: [
          { t: '.313"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.375"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.500"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' }
        ]
      },
      {
        material: '304 Stainless Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Max 4-Sided Flange'],
        rows: [
          { t: '.030"', minF: 'N/A', maxF: 'N/A', maxH: 'N/A' },
          { t: '.048"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.060"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.074"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.100"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.125"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.187"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.250"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.375"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' },
          { t: '.500"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: 'N/A' }
        ]
      },
      {
        material: '316 Stainless Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Max 4-Sided Flange'],
        rows: [
          { t: '.060"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.125"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.187"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' },
          { t: '.250"', minF: '1" x 1.5"', maxF: '36" x 46"', maxH: '3"' }
        ]
      }
    ]
  },
  {
    id: 'plating',
    title: 'Plating',
    content: 'Plating provides corrosion protection and can improve electrical conductivity or aesthetic appearance.',
    requirements: [
      'Zinc plating (Clear and Yellow) is common for steel.',
      'Parts must have mounting points for electrical contact.',
      'Typical thickness: 0.0002" to 0.0004".',
      'Adds 4-7 business days to production time.'
    ],
    tables: [
      {
        material: '4130 Chromoly (zinc plating only)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.190"', min: '1" x 3"', max: '23" x 23"' },
          { t: '.250"', min: '1" x 3"', max: '23" x 23"' }
        ]
      },
      {
        material: 'Copper (nickel plating only, request custom quote)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.187"', min: '1" x 3"', max: '23" x 23"' },
          { t: '.250"', min: '1" x 3"', max: '23" x 23"' }
        ]
      },
      {
        material: 'Cold Rolled Steel (1008) (zinc/nickel plating)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.030"', min: 'N/A', max: 'N/A' },
          { t: '.048"', min: '1" x 3"', max: '23" x 23"' },
          { t: '.059"', min: '1" x 3"', max: '23" x 23"' },
          { t: '.074"', min: '1" x 3"', max: '23" x 23"' },
          { t: '.104"', min: '1" x 3"', max: '23" x 23"' },
          { t: '.119"', min: '1" x 3"', max: '23" x 23"' },
          { t: '.135"', min: '1" x 3"', max: '23" x 23"' }
        ]
      },
      {
        material: 'HRP&O Steel (A36/A1018) (zinc/nickel plating)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.187"', min: '1" x 3"', max: '23" x 23"' },
          { t: '.250"', min: '1" x 3"', max: '23" x 23"' }
        ]
      },
      {
        material: 'Hot Rolled Steel (A36) (zinc/nickel plating)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.313"', min: '1" x 3"', max: '23" x 23"' },
          { t: '.375"', min: '1" x 3"', max: '23" x 23"' },
          { t: '.500"', min: '1" x 3"', max: '23" x 23"' }
        ]
      }
    ]
  },
  {
    id: 'powder-coating',
    title: 'Powder Coating',
    content: 'Powder coating is a durable, thick surface finish available in various colors and textures.',
    requirements: [
      'Available in Matte Black, Gloss Black, White, Red, and more.',
      'Adds roughly 0.003" to 0.010" to overall dimensions.',
      'Masking can be used for critical areas (e.g., threads).',
      'Adds 5-10 business days to production time.'
    ],
    tables: [
      {
        material: '4130 Chromoly',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.050"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.063"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.125"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.190"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.250"', min: '1" x 3"', max: '30" x 36"' }
        ]
      },
      {
        material: '5052 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.040"', min: 'N/A', max: 'N/A' },
          { t: '.063"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.080"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.090"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.100"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.125"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.187"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.250"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.313"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.375"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.500"', min: '1" x 3"', max: '30" x 36"' }
        ]
      },
      {
        material: '6061 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.040"', min: 'N/A', max: 'N/A' },
          { t: '.063"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.080"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.100"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.125"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.187"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.250"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.313"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.375"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.500"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.625"', min: '3" x 3"', max: '30" x 36"' },
          { t: '.750"', min: '3" x 3"', max: '30" x 36"' }
        ]
      },
      {
        material: '7075 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.125"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.190"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.250"', min: '1" x 3"', max: '30" x 36"' }
        ]
      },
      {
        material: 'G90 Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.030"', min: 'N/A', max: 'N/A' },
          { t: '.036"', min: 'N/A', max: 'N/A' },
          { t: '.048"', min: 'N/A', max: 'N/A' },
          { t: '.059"', min: 'N/A', max: 'N/A' },
          { t: '.074"', min: 'N/A', max: 'N/A' }
        ]
      },
      {
        material: 'Cold Rolled Steel (1008)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.030"', min: 'N/A', max: 'N/A' },
          { t: '.048"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.059"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.074"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.104"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.119"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.135"', min: '1" x 3"', max: '30" x 36"' }
        ]
      },
      {
        material: 'HRP&O Steel (A36/A1018)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.187"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.250"', min: '1" x 3"', max: '30" x 36"' }
        ]
      },
      {
        material: 'Hot Rolled Steel (A36)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.313"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.375"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.500"', min: '1" x 3"', max: '30" x 36"' }
        ]
      },
      {
        material: '304 Stainless Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.030"', min: 'N/A', max: 'N/A' },
          { t: '.048"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.060"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.074"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.100"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.125"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.187"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.250"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.375"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.500"', min: '1" x 3"', max: '30" x 36"' }
        ]
      },
      {
        material: '316 Stainless Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part'],
        rows: [
          { t: '.060"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.125"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.187"', min: '1" x 3"', max: '30" x 36"' },
          { t: '.250"', min: '1" x 3"', max: '30" x 36"' }
        ]
      }
    ]
  },
  {
    id: 'tapping',
    title: 'Tapping',
    content: 'We provide internal threading for holes in aluminum, steel, and stainless steel.',
    requirements: [
      'Available sizes: M3, M4, M5, 10-32, 1/4-20, etc.',
      'Material thickness must be at least 1.5x the thread pitch.',
      'Blind holes may have limited thread depth.',
      'Check tapping charts for allowable material/hole combinations.'
    ],
    tables: [
      {
        material: '5052 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Smallest Inch', 'Smallest Metric', 'Largest Inch', 'Largest Metric'],
        rows: [
          { t: '.040"', min: 'N/A', max: 'N/A', smInch: 'N/A', smMetric: 'N/A', lgInch: 'N/A', lgMetric: 'N/A' },
          { t: '.063"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '10/32', lgMetric: 'M4 x 0.7' },
          { t: '.080"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '1/4-28', lgMetric: 'M6 x 1.0' },
          { t: '.090"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '1/4-28', lgMetric: 'M6 x 1.0' },
          { t: '.100"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '1/4-28', lgMetric: 'M6 x 1.0' },
          { t: '.125"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '3/8-24', lgMetric: 'M10 x 1.5' },
          { t: '.187"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M3 x 0.5', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.250"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M3 x 0.5', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.313"', min: '1" x 1.5"', max: '36" x 46"', smInch: '8-32', smMetric: 'M5 x 0.8', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.375"', min: '1" x 1.5"', max: '36" x 46"', smInch: '8-32', smMetric: 'M5 x 0.8', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.500"', min: '1" x 1.5"', max: '36" x 46"', smInch: '10-32', smMetric: 'M5 x 0.8', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' }
        ]
      },
      {
        material: '6061 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Smallest Inch', 'Smallest Metric', 'Largest Inch', 'Largest Metric'],
        rows: [
          { t: '.040"', min: 'N/A', max: 'N/A', smInch: 'N/A', smMetric: 'N/A', lgInch: 'N/A', lgMetric: 'N/A' },
          { t: '.063"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '10-32', lgMetric: 'M6 x 1.0' },
          { t: '.080"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '10-32', lgMetric: 'M6 x 1.0' },
          { t: '.100"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '10-32', lgMetric: 'M6 x 1.0' },
          { t: '.125"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '3/8-24', lgMetric: 'M10 x 1.5' },
          { t: '.187"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M3 x 0.5', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.250"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M3 x 0.5', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.313"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M3 x 0.5', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.375"', min: '1" x 1.5"', max: '36" x 46"', smInch: '8-32', smMetric: 'M5 x 0.8', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.500"', min: '1" x 1.5"', max: '36" x 46"', smInch: '10-32', smMetric: 'M5 x 0.8', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.625"', min: '3" x 3"', max: '36" x 46"', smInch: '5/16-18', smMetric: 'M8 x 1.25', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.750"', min: '3" x 3"', max: '36" x 46"', smInch: '3/8-16', smMetric: 'M10 x 1.5', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' }
        ]
      },
      {
        material: '7075 Aluminum',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Smallest Inch', 'Smallest Metric', 'Largest Inch', 'Largest Metric'],
        rows: [
          { t: '.125"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '3/8-24', lgMetric: 'M10 x 1.5' },
          { t: '.190"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M3 x 0.5', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.250"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M3 x 0.5', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' }
        ]
      },
      {
        material: 'Brass',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Smallest Inch', 'Smallest Metric', 'Largest Inch', 'Largest Metric'],
        rows: [
          { t: '.040"', min: 'N/A', max: 'N/A', smInch: 'N/A', smMetric: 'N/A', lgInch: 'N/A', lgMetric: 'N/A' },
          { t: '.063"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '10-32', lgMetric: 'M6 x 1.0' },
          { t: '.125"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '3/8-24', lgMetric: 'M10 x 1.5' },
          { t: '.187"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.250"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M3 x 0.5', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' }
        ]
      },
      {
        material: 'Copper',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Smallest Inch', 'Smallest Metric', 'Largest Inch', 'Largest Metric'],
        rows: [
          { t: '.040"', min: 'N/A', max: 'N/A', smInch: 'N/A', smMetric: 'N/A', lgInch: 'N/A', lgMetric: 'N/A' },
          { t: '.063"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '10-32', lgMetric: 'M6 x 1.0' },
          { t: '.125"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '3/8-24', lgMetric: 'M10 x 1.5' },
          { t: '.187"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.250"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M3 x 0.5', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' }
        ]
      },
      {
        material: 'G90 Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Smallest Inch', 'Smallest Metric', 'Largest Inch', 'Largest Metric'],
        rows: [
          { t: '.030"', min: 'N/A', max: 'N/A', smInch: 'N/A', smMetric: 'N/A', lgInch: 'N/A', lgMetric: 'N/A' },
          { t: '.036"', min: 'N/A', max: 'N/A', smInch: 'N/A', smMetric: 'N/A', lgInch: 'N/A', lgMetric: 'N/A' },
          { t: '.048"', min: 'N/A', max: 'N/A', smInch: 'N/A', smMetric: 'N/A', lgInch: 'N/A', lgMetric: 'N/A' },
          { t: '.059"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '4-40', lgMetric: 'M3 x 0.5' },
          { t: '.074"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '4-40', lgMetric: 'M6 x 1.0' }
        ]
      },
      {
        material: 'Cold Rolled Steel (1008)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Smallest Inch', 'Smallest Metric', 'Largest Inch', 'Largest Metric'],
        rows: [
          { t: '.030"', min: 'N/A', max: 'N/A', smInch: 'N/A', smMetric: 'N/A', lgInch: 'N/A', lgMetric: 'N/A' },
          { t: '.048"', min: 'N/A', max: 'N/A', smInch: 'N/A', smMetric: 'N/A', lgInch: 'N/A', lgMetric: 'N/A' },
          { t: '.059"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '4-40', lgMetric: 'M3 x 0.5' },
          { t: '.074"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '10-32', lgMetric: 'M6 x 1.0' },
          { t: '.104"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '1/4-28', lgMetric: 'M6 x 1.0' },
          { t: '.119"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '5/16-24', lgMetric: 'M8 x 1.25' },
          { t: '.135"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '3/8-24', lgMetric: 'M10 x 1.5' }
        ]
      },
      {
        material: 'HRP&O Steel (A36/A1018)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Smallest Inch', 'Smallest Metric', 'Largest Inch', 'Largest Metric'],
        rows: [
          { t: '.187"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.250"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' }
        ]
      },
      {
        material: 'Hot Rolled Steel (A36)',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Smallest Inch', 'Smallest Metric', 'Largest Inch', 'Largest Metric'],
        rows: [
          { t: '.313"', min: '.950" x 1.5"', max: '36" x 46"', smInch: '1/4-20', smMetric: 'M4 x 0.7', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.375"', min: '1" x 1.5"', max: '36" x 46"', smInch: '1/4-20', smMetric: 'M6 x 1.0', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.500"', min: '1" x 1.5"', max: '36" x 46"', smInch: '1/4-20', smMetric: 'M6 x 1.0', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' }
        ]
      },
      {
        material: '304 Stainless Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Smallest Inch', 'Smallest Metric', 'Largest Inch', 'Largest Metric'],
        rows: [
          { t: '.030"', min: 'N/A', max: 'N/A', smInch: 'N/A', smMetric: 'N/A', lgInch: 'N/A', lgMetric: 'N/A' },
          { t: '.048"', min: 'N/A', max: 'N/A', smInch: 'N/A', smMetric: 'N/A', lgInch: 'N/A', lgMetric: 'N/A' },
          { t: '.060"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '10-32', lgMetric: 'M6 x 1.0' },
          { t: '.074"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '10-32', lgMetric: 'M6 x 1.0' },
          { t: '.100"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '1/4-28', lgMetric: 'M6 x 1.0' },
          { t: '.125"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '3/8-24', lgMetric: 'M10 x 1.5' },
          { t: '.187"', min: '1" x 1.5"', max: '36" x 46"', smInch: '6-32', smMetric: 'M3 x 0.5', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.250"', min: '1" x 1.5"', max: '36" x 46"', smInch: '8-32', smMetric: 'M4 x 0.7', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.375"', min: '1" x 1.5"', max: '36" x 46"', smInch: '1/4-20', smMetric: 'M6 x 1.0', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' },
          { t: '.500"', min: '1" x 1.5"', max: '36" x 46"', smInch: '1/4-20', smMetric: 'M6 x 1.0', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' }
        ]
      },
      {
        material: '316 Stainless Steel',
        headers: ['Thickness', 'Min Flat Part', 'Max Flat Part', 'Smallest Inch', 'Smallest Metric', 'Largest Inch', 'Largest Metric'],
        rows: [
          { t: '.060"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '10-32', lgMetric: 'M6 x 1.0' },
          { t: '.125"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '3/8-24', lgMetric: 'M10 x 1.5' },
          { t: '.187"', min: '1" x 1.5"', max: '36" x 46"', smInch: '4-40', smMetric: 'M2 x 0.4', lgInch: '3/8-24', lgMetric: 'M10 x 1.5' },
          { t: '.250"', min: '1" x 1.5"', max: '36" x 46"', smInch: '8-32', smMetric: 'M4 x 0.7', lgInch: '1/2-20', lgMetric: 'M10 x 1.5' }
        ]
      }
    ]
  },
  {
    id: 'tumbling',
    title: 'Tumbling',
    content: 'Ceramic tumbling uses abrasive media to remove burrs and soften edges on small parts.',
    requirements: [
      'Best for parts smaller than 6" x 6".',
      'Provides a matte, uniform edge softening.',
      'May slightly round sharp corners and edges.',
      'Not recommended for parts with delicate features.'
    ],
    tables: [
      {
        material: '5052 Aluminum',
        headers: ['Thickness', 'Min Part Size', 'Max Part Size'],
        rows: [
          { t: '.040"', min: 'N/A', max: 'N/A' },
          { t: '.063"', min: 'N/A', max: 'N/A' },
          { t: '.080"', min: 'N/A', max: 'N/A' },
          { t: '.090"', min: 'N/A', max: 'N/A' },
          { t: '.100"', min: 'N/A', max: 'N/A' },
          { t: '.125"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.187"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.250"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.313"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.375"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.500"', min: '0.5" x 1.5"', max: '4" x 7"' }
        ]
      },
      {
        material: '6061 Aluminum',
        headers: ['Thickness', 'Min Part Size', 'Max Part Size'],
        rows: [
          { t: '.040"', min: 'N/A', max: 'N/A' },
          { t: '.063"', min: 'N/A', max: 'N/A' },
          { t: '.080"', min: 'N/A', max: 'N/A' },
          { t: '.100"', min: 'N/A', max: 'N/A' },
          { t: '.125"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.187"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.250"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.313"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.375"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.500"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.625"', min: '3" x 3"', max: '4" x 7"' },
          { t: '.750"', min: '3" x 3"', max: '4" x 7"' }
        ]
      },
      {
        material: '7075 Aluminum',
        headers: ['Thickness', 'Min Part Size', 'Max Part Size'],
        rows: [
          { t: '.125"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.190"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.250"', min: '0.5" x 1.5"', max: '4" x 7"' }
        ]
      },
      {
        material: '1075 Blue Temper Spring Steel',
        headers: ['Thickness', 'Min Part Size', 'Max Part Size'],
        rows: [
          { t: 'N/A', min: 'N/A', max: 'N/A' }
        ]
      },
      {
        material: 'Brass',
        headers: ['Thickness', 'Min Part Size', 'Max Part Size'],
        rows: [
          { t: '.040"', min: 'N/A', max: 'N/A' },
          { t: '.063"', min: 'N/A', max: 'N/A' },
          { t: '.125"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.187"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.250"', min: '0.5" x 1.5"', max: '4" x 7"' }
        ]
      },
      {
        material: '4130 Chromoly',
        headers: ['Thickness', 'Min Part Size', 'Max Part Size'],
        rows: [
          { t: '.050"', min: 'N/A', max: 'N/A' },
          { t: '.063"', min: 'N/A', max: 'N/A' },
          { t: '.125"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.190"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.250"', min: '0.5" x 1.5"', max: '4" x 7"' }
        ]
      },
      {
        material: 'Copper',
        headers: ['Thickness', 'Min Part Size', 'Max Part Size'],
        rows: [
          { t: '.040"', min: 'N/A', max: 'N/A' },
          { t: '.063"', min: 'N/A', max: 'N/A' },
          { t: '.125"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.187"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.250"', min: '0.5" x 1.5"', max: '4" x 7"' }
        ]
      },
      {
        material: 'Cold Rolled Steel (1008)',
        headers: ['Thickness', 'Min Part Size', 'Max Part Size'],
        rows: [
          { t: '.030"', min: 'N/A', max: 'N/A' },
          { t: '.048"', min: 'N/A', max: 'N/A' },
          { t: '.059"', min: 'N/A', max: 'N/A' },
          { t: '.074"', min: 'N/A', max: 'N/A' },
          { t: '.104"', min: 'N/A', max: 'N/A' },
          { t: '.119"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.135"', min: '0.5" x 1.5"', max: '4" x 7"' }
        ]
      },
      {
        material: 'HRP&O Steel (A36/A1018)',
        headers: ['Thickness', 'Min Part Size', 'Max Part Size'],
        rows: [
          { t: '.187"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.250"', min: '0.5" x 1.5"', max: '4" x 7"' }
        ]
      },
      {
        material: 'Hot Rolled Steel (A36)',
        headers: ['Thickness', 'Min Part Size', 'Max Part Size'],
        rows: [
          { t: '.313"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.375"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.500"', min: '0.5" x 1.5"', max: '4" x 7"' }
        ]
      },
      {
        material: '304 Stainless Steel',
        headers: ['Thickness', 'Min Part Size', 'Max Part Size'],
        rows: [
          { t: '.030"', min: 'N/A', max: 'N/A' },
          { t: '.048"', min: 'N/A', max: 'N/A' },
          { t: '.060"', min: 'N/A', max: 'N/A' },
          { t: '.074"', min: 'N/A', max: 'N/A' },
          { t: '.100"', min: 'N/A', max: 'N/A' },
          { t: '.125"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.187"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.250"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.375"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.500"', min: '0.5" x 1.5"', max: '4" x 7"' }
        ]
      },
      {
        material: '316 Stainless Steel',
        headers: ['Thickness', 'Min Part Size', 'Max Part Size'],
        rows: [
          { t: '.060"', min: 'N/A', max: 'N/A' },
          { t: '.125"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.187"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.250"', min: '0.5" x 1.5"', max: '4" x 7"' }
        ]
      },
      {
        material: 'Grade 2 Titanium',
        headers: ['Thickness', 'Min Part Size', 'Max Part Size'],
        rows: [
          { t: '.040"', min: 'N/A', max: 'N/A' }
        ]
      },
      {
        material: 'Grade 5 Titanium',
        headers: ['Thickness', 'Min Part Size', 'Max Part Size'],
        rows: [
          { t: '.040"', min: 'N/A', max: 'N/A' },
          { t: '.060"', min: 'N/A', max: 'N/A' },
          { t: '.125"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.187"', min: '0.5" x 1.5"', max: '4" x 7"' },
          { t: '.250"', min: '0.5" x 1.5"', max: '4" x 7"' }
        ]
      }
    ]
  }

];
