import metal2 from '../assets/metals/metal-2.jpg';
import metal3 from '../assets/metals/metal-3.jpg';
import metal4 from '../assets/metals/metal-4.jpg';
import metal5 from '../assets/metals/metal-5.jpg';
import metal6 from '../assets/metals/metal-6.jpg';
import metal7 from '../assets/metals/metal-7.png';
import metal8 from '../assets/metals/metal-8.jpg';
import metal9 from '../assets/metals/metal-9.jpg';
import metal10 from '../assets/metals/metal-10.jpg';
import metal11 from '../assets/metals/metal-11.png';
import metal12 from '../assets/metals/metal-12.jpg';
import metal13 from '../assets/metals/metal-13.png';
import metal14 from '../assets/metals/metal-14.jpg';
import metal15 from '../assets/metals/metal-15.jpg';
import metal16 from '../assets/metals/metal-16.jpg';
import metal17 from '../assets/metals/metal-17.png';
import metal18 from '../assets/metals/metal-18.jpg';
import ar400_250_showcase from '../assets/metals/ar400-250.png';
import aboutAR400 from '../assets/metals/ar400-about.png';
import aboutAR500 from '../assets/metals/ar500-about.png';
import about1075 from '../assets/metals/1075-about.png';
import about4130 from '../assets/metals/4130-about.png';
import aboutCopper from '../assets/metals/copper-about.png';
import aboutMagnaCut from '../assets/metals/magnacut-about.png';
import g90_030_showcase from '../assets/metals/g90-030-showcase.png';
import g90_036_showcase from '../assets/metals/g90-036-showcase.jpg';
import g90_048_showcase from '../assets/metals/g90-048-showcase.png';
import g90_059_showcase from '../assets/metals/g90-059-showcase.png';
import g90_074_showcase from '../assets/metals/g90-074-showcase.png';
import aboutG90 from '../assets/metals/g90-about.png';
import about1095 from '../assets/metals/metal13_about.png';
import coldRolledParts from '../assets/metals/cold-rolled-parts.png';
import aboutStainless from '../assets/metals/about-stainless.png';


// About images
import aboutMetal1 from '../assets/metals/about-metal-1.jpg';
import aboutMetal2 from '../assets/metals/about-metal-2.jpg';
import about6061 from '../assets/metals/6061-about-enhanced.png';

// 5052-H32 Aluminum Showcase Images
import h32_1 from '../assets/metals/5052-h32-1.png';
import h32_2 from '../assets/metals/5052-h32-2.png';
import h32_3 from '../assets/metals/5052-h32-3.png';
import h32_4 from '../assets/metals/5052-h32-4.png';
import h32_5 from '../assets/metals/5052-h32-5.png';
import h32_6 from '../assets/metals/5052-h32-6.png';
import h32_7 from '../assets/metals/5052-h32-7.png';
import h32_8 from '../assets/metals/5052-h32-8.png';
import h32_9 from '../assets/metals/5052-h32-9.png';
import h32_10 from '../assets/metals/5052-h32-10.png';
import h32_11 from '../assets/metals/5052-h32-11.png';
import metal4_125_enhanced from '../assets/metals/7075-t6-125-enhanced.png';
import metal4_190 from '../assets/metals/7075-t6-190.png';
import metal4_250 from '../assets/metals/7075-t6-250.png';
import about7075 from '../assets/metals/7075-t6-about.png';
import brass_showcase from '../assets/metals/brass_showcase.png';
import brass_about from '../assets/metals/brass_about.png';

export const metalsData = [

    {
        id: 2,
        name: "5052 H32 ALUMINUM",
        thickness: "11 thicknesses: .040\" - .500\"",
        image: metal2,
        description: "Excellent corrosion resistance, good weldability, and moderate strength.",
        quickLook: {
            cutSizes: [
                { label: "A", size: ".25\" x .375\" min", action: "Instant Pricing", type: "solid" },
                { label: "B", size: "30\" x 44\" max", action: "Instant Pricing", type: "solid" },
                { label: "C", size: "30\" x 56\" max", action: "Custom Quote", type: "outline" }
            ],
            thicknesses: [
                { value: ".040\"", metric: "1.02mm" },
                { value: ".063\"", metric: "1.60mm" },
                { value: ".080\"", metric: "2.03mm" },
                { value: ".090\"", metric: "2.29mm" },
                { value: ".100\"", metric: "2.54mm" },
                { value: ".125\"", metric: "3.18mm" },
                { value: ".187\"", metric: "4.75mm" },
                { value: ".250\"", metric: "6.35mm" },
                { value: ".313\"", metric: "8.00mm" },
                { value: ".375\"", metric: "9.53mm" },
                { value: ".500\"", metric: "12.7mm" }
            ],
            tolerance: "+/- .005\""
        },
        specifications: {
            // Default specifications (shared properties)
            properties: [
                { label: "Material Composition", value: "Aluminum (Al): 95.8 – 97.7 Magnesium (Mg): 2.2 – 2.8 Chromium (Cr): 0.15 – 0.35 Iron (Fe): 0 – 0.4 Silicon (Si): 0 – 0.25 Manganese (Mn): 0 – 0.1 Zinc (Zn): 0 – 0.1 Copper (Cu): 0 – 0.1 Residuals: 0 – 0.15" },
                { label: "Density", value: "169.344 lb/ft^3" },
                { label: "Heat treatments process", value: "N/A" },
                { label: "ASTM", value: "B209-14" },
                { label: "Tensile Strength (Ultimate)", value: "34 ksi" },
                { label: "Tensile Strength (Yield)", value: "26 ksi" },
                { label: "Shear Strength", value: "20 ksi" },
                { label: "Shear Modulus", value: "3700 ksi" },
                { label: "Fatigue Strength", value: "17 ksi" },
                { label: "Brinell Hardness", value: "60" },
                { label: "Elongation at Break", value: "12%" },
                { label: "Elastic Modulus", value: "9900 ksi" },
                { label: "Poisson’s Ratio", value: ".33" },
                { label: "Thermal Conductivity", value: "138 BTU/h-ft °F" },
                { label: "Melting Point", value: "1120 °F" },
                { label: "Magnetic", value: "No" },
                { label: "Does it Rust", value: "No" }
            ]
        },
        thicknessSpecs: {
            ".040\"": {
                showcaseImages: [h32_1],
                availableServices: ["Laser Cutting", "Bending", "Dimple Forming", "Hardware"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.040\"", mm: "1.02 mm" },
                    { label: "Gauge", inch: "18", mm: "18" },
                    { label: "Thickness tolerance positive", inch: "0.004 in", mm: "0.102 mm" },
                    { label: "Thickness tolerance negative", inch: "0.004 in", mm: "0.102 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005 in", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "0.25 in x 0.375 in", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "56 in x 30 in", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: "0.015 in", mm: "0.381 mm" },
                    { label: "Min bridge size", inch: "0.020 in", mm: "0.508 mm" },
                    { label: "Min hole to edge distance", inch: "0.020 in", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: "0.010 in", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: "0.375 in x 1.5 in", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44 in x 30 in", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44 in", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.255 in", mm: "6.477 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.286 in", mm: "7.264 mm" },
                    { label: "Min Length Center of bend line 91-130° (Acute)", inch: "0.332 in", mm: "8.433 mm" },
                    { label: "Die width", inch: "0.472 in", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.024 in", mm: "0.61 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.062 in", mm: "1.575 mm" },
                    { label: "K Factor", inch: "0.45", mm: "0.45" },
                    { label: "Bend relief depth", inch: "0.084 in", mm: "2.134 mm" },
                    { label: "Min joggle (Bend line to bend line @90°)", inch: "0.363 in", mm: "9.22 mm" },
                    { label: "Max joggle (Bend line to bend line @90°)", inch: "3.750 in", mm: "95.25 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.2 in x 5.2 in", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26 in x 56 in", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: "0.5 in", mm: "12.7 mm" },
                    { label: "Largest dimple", inch: "3.0 in", mm: "76.2 mm" },
                    { label: "Dimple overall height (.500 in)", inch: "0.132 in", mm: "3.353 mm" },
                    { label: "Dimple overall height (.750 in)", inch: "0.130 in", mm: "3.302 mm" },
                    { label: "Dimple overall height (1.000 in)", inch: "0.178 in", mm: "4.521 mm" },
                    { label: "Dimple overall height (1.250 in)", inch: "0.188 in", mm: "4.775 mm" },
                    { label: "Dimple overall height (1.500 in)", inch: "0.200 in", mm: "5.08 mm" },
                    { label: "Dimple overall height (1.750 in)", inch: "0.210 in", mm: "5.334 mm" },
                    { label: "Dimple overall height (2.000 in)", inch: "0.230 in", mm: "5.842 mm" },
                    { label: "Dimple overall height (2.500 in)", inch: "0.288 in", mm: "7.315 mm" },
                    { label: "Dimple overall height (3.000 in)", inch: "0.370 in", mm: "9.398 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1 in x 1.5 in", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36 in x 46 in", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3 in", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ]
            },
            ".063\"": {
                showcaseImages: [h32_2],
                availableServices: ["Laser Cutting", "Anodizing", "Bending", "Deburring", "Dimple Forming", "Hardware", "Powder Coating", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.063\"", mm: "1.60 mm" },
                    { label: "Gauge", inch: "14", mm: "14" },
                    { label: "Thickness tolerance positive", inch: "0.004 in", mm: "0.102 mm" },
                    { label: "Thickness tolerance negative", inch: "0.004 in", mm: "0.102 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005 in", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "0.25 in x 0.375 in", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "56 in x 30 in", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: "0.022\"", mm: "0.559 mm" },
                    { label: "Min bridge size", inch: "0.024\"", mm: "0.61 mm" },
                    { label: "Min hole to edge distance", inch: "0.020 in", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: "0.010 in", mm: "0.254 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: "0.375 in x 1.5 in", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44 in x 30 in", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44 in", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.255 in", mm: "6.477 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.303\"", mm: "7.696 mm" },
                    { label: "Die width", inch: "0.472 in", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.035\"", mm: "0.889 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.096\"", mm: "2.438 mm" },
                    { label: "K Factor", inch: "0.42", mm: "0.42" },
                    { label: "Bend relief depth", inch: "0.118\"", mm: "2.997 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "0.324\"", mm: "8.23 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750 in", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 5\"", mm: "25.4 mm x 127 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.200\" x 5.200\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: ".500\"", mm: "12.7 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (.500\" dimple)", inch: ".153\"", mm: "3.886 mm" },
                    { label: "Dimple overall height (.750\" dimple)", inch: ".151\"", mm: "3.835 mm" },
                    { label: "Dimple overall height (1.000\" dimple)", inch: ".200\"", mm: "5.08 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".213\"", mm: "5.41 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".230\"", mm: "5.842 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".240\"", mm: "6.096 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".257\"", mm: "6.528 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".307\"", mm: "7.798 mm" },
                    { label: "Dimple overall height (3.000\" dimple)", inch: ".380\"", mm: "9.652 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1″ x 1.5″", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36″ x 46″", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "10-32", mm: "10-32" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.020\"", mm: "0.508 mm" }
                ]
            },
            ".080\"": {
                showcaseImages: [h32_3],
                availableServices: ["Laser Cutting", "Anodizing", "Bending", "Deburring", "Dimple Forming", "Hardware", "Powder Coating", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.080\"", mm: "2.03 mm" },
                    { label: "Gauge", inch: "12", mm: "12" },
                    { label: "Thickness tolerance positive", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Thickness tolerance negative", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: ".028\"", mm: "0.711 mm" },
                    { label: "Min bridge size", inch: ".030\"", mm: "0.762 mm" },
                    { label: "Min hole to edge distance", inch: ".024\"", mm: "0.61 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44 in x 30 in", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.313\"", mm: "7.95 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: ".332\"", mm: "8.433 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.038\"", mm: "0.965 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.116\"", mm: "2.946 mm" },
                    { label: "K Factor", inch: "0.48", mm: "0.48" },
                    { label: "Bend relief depth", inch: "0.150\"", mm: "3.81 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "0.343\"", mm: "8.712 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 5\"", mm: "25.4 mm x 127 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.200\" x 5.200\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: ".750\"", mm: "19.05 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (.750\" dimple)", inch: ".175\"", mm: "4.445 mm" },
                    { label: "Dimple overall height (1.000\" dimple)", inch: ".215\"", mm: "5.461 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".225\"", mm: "5.715 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".250\"", mm: "6.35 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".265\"", mm: "6.731 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".278\"", mm: "7.061 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".327\"", mm: "8.306 mm" },
                    { label: "Dimple overall height (3.000\" dimple)", inch: ".400\"", mm: "10.16 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/4-28", mm: "1/4-28" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.024\"", mm: "0.61 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.024\"", mm: "Tap hole size/2 +0.61 mm" }
                ]
            },
            ".090\"": {
                showcaseImages: [h32_4],
                availableServices: ["Laser Cutting", "Anodizing", "Bending", "Deburring", "Dimple Forming", "Hardware", "Powder Coating", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.090\"", mm: "2.29 mm" },
                    { label: "Gauge", inch: "11", mm: "11" },
                    { label: "Thickness tolerance positive", inch: "0.000\"", mm: "0.00 mm" },
                    { label: "Thickness tolerance negative", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: ".032\"", mm: "0.813 mm" },
                    { label: "Min bridge size", inch: ".034\"", mm: "0.864 mm" },
                    { label: "Min hole to edge distance", inch: ".027\"", mm: "0.686 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44 in x 30 in", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.326\"", mm: "8.28 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: ".332\"", mm: "8.433 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.032\"", mm: "0.813 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.142\"", mm: "3.607 mm" },
                    { label: "K Factor", inch: "0.37", mm: "0.37" },
                    { label: "Bend relief depth", inch: "0.142\"", mm: "3.607 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "0.354\"", mm: "8.992 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 5\"", mm: "25.4 mm x 127 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.200\" x 5.200\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: "1.000\"", mm: "25.4 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (1.000\" dimple)", inch: ".230\"", mm: "5.842 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".245\"", mm: "6.223 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".265\"", mm: "6.731 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".275\"", mm: "6.985 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".282\"", mm: "7.163 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".345\"", mm: "8.763 mm" },
                    { label: "Dimple overall height (3.000\" dimple)", inch: ".418\"", mm: "10.617 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/4-28", mm: "1/4-28" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.027\"", mm: "0.686 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.027\"", mm: "Tap hole size/2 +0.686 mm" }
                ]
            },
            ".100\"": {
                showcaseImages: [h32_5],
                availableServices: ["Laser Cutting", "Anodizing", "Bending", "Deburring", "Dimple Forming", "Hardware", "Plating", "Powder Coating", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.100\"", mm: "2.54 mm" },
                    { label: "Gauge", inch: "10", mm: "10" },
                    { label: "Thickness tolerance positive", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Thickness tolerance negative", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: ".035\"", mm: "0.889 mm" },
                    { label: "Min bridge size", inch: ".038\"", mm: "0.965 mm" },
                    { label: "Min hole to edge distance", inch: ".030\"", mm: "0.762 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44 in x 30 in", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.368\"", mm: "9.347 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.463\"", mm: "11.76 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "0.478\"", mm: "12.141 mm" },
                    { label: "Die width", inch: "0.630\"", mm: "16.002 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.125\"", mm: "3.175 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.191\"", mm: "4.851 mm" },
                    { label: "K Factor", inch: "0.40", mm: "0.40" },
                    { label: "Bend relief depth", inch: "0.245\"", mm: "6.223 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "0.478\"", mm: "12.141 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 5\"", mm: "25.4 mm x 127 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/4-28", mm: "1/4-28" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.030\"", mm: "0.762 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.030\"", mm: "Tap hole size/2 +0.762 mm" }
                ]
            },
            ".125\"": {
                showcaseImages: [h32_6],
                availableServices: ["Laser Cutting", "Anodizing", "Bending", "Countersinking", "Deburring", "Dimple Forming", "Hardware", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.125\"", mm: "3.175 mm" },
                    { label: "Gauge", inch: "8", mm: "8" },
                    { label: "Thickness tolerance positive", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Thickness tolerance negative", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: ".044\"", mm: "1.118 mm" },
                    { label: "Min bridge size", inch: ".048\"", mm: "1.219 mm" },
                    { label: "Min hole to edge distance", inch: ".038\"", mm: "0.965 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44 in x 30 in", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.368\"", mm: "9.347 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.476\"", mm: "12.09 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: ".478\"", mm: "12.141 mm" },
                    { label: "Die width", inch: "0.630\"", mm: "16.002 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.125\"", mm: "3.175 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.216\"", mm: "5.486 mm" },
                    { label: "K Factor", inch: "0.44", mm: "0.44" },
                    { label: "Bend relief depth", inch: "0.270\"", mm: "6.858 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "0.506\"", mm: "12.852 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: ".099\"", mm: "2.515 mm" },
                    { label: "Countersink Max Major", inch: ".472\"", mm: "11.989 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: ".246\"", mm: "6.248 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M10 x 1.5", mm: "M10 x 1.5" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.038\"", mm: "0.965 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.038\"", mm: "Tap hole size/2 +0.965 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".187\"": {
                showcaseImages: [h32_7],
                availableServices: ["Laser Cutting", "Anodizing", "Bending", "Countersinking", "Deburring", "Hardware", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.187\"", mm: "4.75 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.009\"", mm: "0.229 mm" },
                    { label: "Thickness tolerance negative", inch: "0.009\"", mm: "0.229 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".500\" x .750\"", mm: "12.7 mm x 19.05 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: ".042\" (Recommended .065\")", mm: "1.067 mm (Recommended 1.651 mm)" },
                    { label: "Min bridge size", inch: ".071\"", mm: "1.803 mm" },
                    { label: "Min hole to edge distance", inch: ".056\"", mm: "1.422 mm" },
                    { label: "Tab and slot tolerance", inch: ".015\"", mm: "0.381 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44 in x 30 in", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.620\"", mm: "15.748 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.798\"", mm: "20.27 mm" },
                    { label: "Die width", inch: "0.984\"", mm: "25.0 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.250\"", mm: "6.35 mm" },
                    { label: "Max bend angle", inch: "90°", mm: "90°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.356\"", mm: "9.042 mm" },
                    { label: "K Factor", inch: "0.43", mm: "0.43" },
                    { label: "Bend relief depth", inch: "0.457\"", mm: "11.608 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "0.826\"", mm: "20.98 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: ".099\"", mm: "2.515 mm" },
                    { label: "Countersink Max Major", inch: ".531\"", mm: "13.487 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: ".276\"", mm: "7.01 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "4-40", mm: "4-40" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.056\"", mm: "1.422 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.056\"", mm: "Tap hole size/2 +1.422 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".250\"": {
                showcaseImages: [h32_8],
                availableServices: ["Laser Cutting", "Anodizing", "Bending", "Countersinking", "Deburring", "Hardware", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.250\"", mm: "6.35 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.027\"", mm: "0.686 mm" },
                    { label: "Thickness tolerance negative", inch: "0.027\"", mm: "0.686 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".500\" x .750\"", mm: "12.7 mm x 19.05 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: ".057\" (Recommended .088\")", mm: "1.448 mm (Recommended 2.235 mm)" },
                    { label: "Min bridge size", inch: ".095\"", mm: "2.413 mm" },
                    { label: "Min hole to edge distance", inch: ".075\"", mm: "1.905 mm" },
                    { label: "Tab and slot tolerance", inch: ".035\"", mm: "0.889 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44 in x 30 in", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "1.150\"", mm: "29.21 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "1.371\"", mm: "34.823 mm" },
                    { label: "Die width", inch: "1.575\"", mm: "40.0 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.250\"", mm: "6.35 mm" },
                    { label: "Max bend angle", inch: "90°", mm: "90°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.442\"", mm: "11.227 mm" },
                    { label: "K Factor", inch: "0.42", mm: "0.42" },
                    { label: "Bend relief depth", inch: "0.520\"", mm: "13.208 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "1.425\"", mm: "36.195 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: ".099\"", mm: "2.515 mm" },
                    { label: "Countersink Max Major", inch: ".656\"", mm: "16.662 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: ".338\"", mm: "8.585 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "4-40", mm: "4-40" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.075\"", mm: "1.905 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.075\"", mm: "Tap hole size/2 +1.905 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".313\"": {
                showcaseImages: [h32_9],
                availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Hardware", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.313\"", mm: "7.95 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.014\"", mm: "0.356 mm" },
                    { label: "Thickness tolerance negative", inch: "0.014\"", mm: "0.356 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA", mm: "USA" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".500\" x .750\"", mm: "12.7 mm x 19.05 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: ".075\" (Recommended .090\")", mm: "1.905 mm (Recommended 2.286 mm)" },
                    { label: "Min bridge size", inch: ".125\"", mm: "3.175 mm" },
                    { label: "Min hole to edge distance", inch: ".094\"", mm: "2.388 mm" },
                    { label: "Tab and slot tolerance", inch: ".035\"", mm: "0.889 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: ".099\"", mm: "2.515 mm" },
                    { label: "Countersink Max Major", inch: ".656\"", mm: "16.662 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: ".338\"", mm: "8.585 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "4-40", mm: "4-40" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.094\"", mm: "2.388 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.075\"", mm: "Tap hole size/2 +1.905 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".375\"": {
                showcaseImages: [h32_10],
                availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Hardware", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.375\"", mm: "9.525 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.033\"", mm: "0.838 mm" },
                    { label: "Thickness tolerance negative", inch: "0.033\"", mm: "0.838 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "Global", mm: "Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".75\" x 1.00\"", mm: "19.05 mm x 25.4 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: ".085\" (Recommended .130\")", mm: "2.159 mm (Recommended 3.302 mm)" },
                    { label: "Min bridge size", inch: ".143\"", mm: "3.632 mm" },
                    { label: "Min hole to edge distance", inch: ".113\"", mm: "2.87 mm" },
                    { label: "Tab and slot tolerance", inch: ".040\"", mm: "1.016 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: ".130\"", mm: "3.302 mm" },
                    { label: "Countersink Max Major", inch: ".656\"", mm: "16.662 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: ".338\"", mm: "8.585 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "12/20", mm: "12/20" },
                    { label: "Smallest Tap", inch: "8-32", mm: "8-32" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.113\"", mm: "2.87 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.113\"", mm: "Tap hole size/2 +2.87 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".500\"": {
                showcaseImages: [h32_11],
                availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Hardware", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.500\"", mm: "12.7 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.043\"", mm: "1.092 mm" },
                    { label: "Thickness tolerance negative", inch: "0.043\"", mm: "1.092 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "Global", mm: "Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "1.00\" x 1.00\"", mm: "25.4 mm x 25.4 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: ".125\" (Recommended .170\")", mm: "3.175 mm (Recommended 4.318 mm)" },
                    { label: "Min bridge size", inch: ".190\"", mm: "4.826 mm" },
                    { label: "Min hole to edge distance", inch: ".150\"", mm: "3.81 mm" },
                    { label: "Tab and slot tolerance", inch: ".050\"", mm: "1.27 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: ".193\"", mm: "4.902 mm" },
                    { label: "Countersink Max Major", inch: ".656\"", mm: "16.662 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: ".338\"", mm: "8.585 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "10-32", mm: "10-32" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.150\"", mm: "3.81 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.150\"", mm: "Tap hole size/2 +3.81 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            }
        },
        aboutSection: {
            title: "What is 5052 H32 Aluminum?",
            text: "5052 H32 aluminum is strong, inexpensive, and lightweight. Whether you're welding, machining, or bending, 5052 aluminum is going to be the go-to material for those projects that need excellent all-around material properties. Our laser cut 5052 aluminum is exceptionally lightweight and strong, making it perfect for projects where overall load is a concern.",
            image: aboutMetal2,
            featureChart: [
                { label: "Strength", rating: 3 },
                { label: "Weldability", rating: 4 },
                { label: "Formability", rating: 5 },
                { label: "Heat Treating", rating: 2 },
                { label: "Corrosion Resistance", rating: 5 },
                { label: "Toughness", rating: 4 },
                { label: "Machinability", rating: 3 },
                { label: "Strength-to-Weight Ratio", rating: 4 }
            ],
            capabilities: {
                title: "What can you make with 5052 H32 Aluminum parts?",
                text: "With high relative ultimate strength (and fatigue strength), 5052 aluminum has a number of practical usages. It is non-heat treatable, which means that it is cold-worked to achieve its moderate-to-high strength properties. For greater strength, check out our 6061 series aluminum.",
                items: ["Robotics", "Hinges", "Signage", "Fences", "Marine applications", "Panels", "Heat exchangers", "And so much more!"]
            }
        },
        faqs: [
            {
                question: "What thicknesses does DMS Engineering offer 5052 H32 Aluminum in?",
                answer: "DMS Engineering offers 5052 H32 Aluminum in ten thickness options: .040'' (1.02mm), .063'' (1.60mm), .080'' (2.03mm), .090'' (2.29mm), .100'' (2.54mm), .125'' (3.18mm), .187'' (4.75mm), .250'' (6.35mm), .375''(9.5mm), .500'' (12.7mm)."
            },
            {
                question: "What are the minimum and maximum sizes for cutting 5052 H32 Aluminum?",
                answer: "5052 H32 Aluminum is available at DMS Engineering with a range of thicknesses and part sizes. Instant quotes are possible for dimensions between .25'' x .375'' and 13'' x 44'', while custom quoting extends the maximum size to 13'' x 56''."
            },
            {
                question: "What additional services are available for 5052 H32 Aluminum?",
                answer: "You can add the following services to your 5052 H32 Aluminum parts: Anodizing, Bending, Deburring, Countersinking, Engraving, Dimple Forming, Hardware Insertion, Powder Coating, Tapping, and Tumbling"
            }
        ],
        services: [3, 9, 4, 5, 6, 8, 11, 7, 12]
    },
    {
        id: 3,
        name: "6061 T6 ALUMINUM",
        thickness: "12 thicknesses: .040\" - .750\"",
        image: metal3,
        description: "Versatile, high-strength aluminum with good corrosion resistance and machinability.",
        quickLook: {
            cutSizes: [
                { label: "A", size: ".25\" x .375\" min", action: "Instant Pricing", type: "solid" },
                { label: "B", size: "30\" x 44\" max", action: "Instant Pricing", type: "solid" },
                { label: "C", size: "30\" x 56\" max", action: "Custom Quote", type: "outline" }
            ],
            thicknesses: [
                { value: ".040\"", metric: "1.02mm" },
                { value: ".063\"", metric: "1.60mm" },
                { value: ".080\"", metric: "2.03mm" },
                { value: ".100\"", metric: "2.54mm" },
                { value: ".125\"", metric: "3.18mm" },
                { value: ".187\"", metric: "4.75mm" },
                { value: ".250\"", metric: "6.35mm" },
                { value: ".313\"", metric: "8.00mm" },
                { value: ".375\"", metric: "9.53mm" },
                { value: ".500\"", metric: "12.7mm" },
                { value: ".625\"", metric: "15.88mm" },
                { value: ".750\"", metric: "19.05mm" }
            ],
            tolerance: "+/- .005\""
        },
        specifications: {
            availableServices: [],
            generalDetails: [],
            laserCuttingSpecs: [],
            properties: [
                { label: "Material Composition", value: "Aluminum (Al): 95.9 – 98.6 Magnesium (Mg): 0.8 – 1.2 Silicon (Si): 0.4 – 0.8 Iron (Fe): 0 – 0.7 Copper (Cu): 0.15 – 0.4 Chromium (Cr): 0.040 – 0.35 Zinc (Zn): 0 – 0.25 Manganese (Mn): 0 – 0.15 Titanium (Ti): 0 – 0.15 Residuals: 0 – 0.15" },
                { label: "Density", value: "169.344 lb/ft^3" },
                { label: "Heat treatments process", value: "T6" },
                { label: "ASTM", value: "B209-21" },
                { label: "Tensile Strength (Ultimate)", value: "45 ksi" },
                { label: "Tensile Strength (Yield)", value: "39 ksi" },
                { label: "Shear Strength", value: "30 ksi" },
                { label: "Shear Modulus", value: "3800 ksi" },
                { label: "Fatigue Strength", value: "14 ksi" },
                { label: "Brinell Hardness", value: "93" },
                { label: "Elongation at Break", value: "10%" },
                { label: "Elastic Modulus", value: "10000 ksi" },
                { label: "Poisson’s Ratio", value: ".33" },
                { label: "Thermal Conductivity", value: "170 BTU/h-ft °F" },
                { label: "Melting Point", value: "1080 °F" },
                { label: "Magnetic", value: "No" },
                { label: "Does it Rust", value: "No" }
            ]
        },
        thicknessSpecs: {
            ".040\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Dimple Forming", "Hardware Insertion"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.040\"", mm: "1.02 mm" },
                    { label: "Gauge", inch: "18", mm: "18" },
                    { label: "Thickness tolerance positive", inch: "0.004\"", mm: "0.102 mm" },
                    { label: "Thickness tolerance negative", inch: "0.004\"", mm: "0.102 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "Global", mm: "Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "0.25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".016\"", mm: "0.406 mm" },
                    { label: "Min bridge size", inch: ".014\"", mm: "0.356 mm" },
                    { label: "Min hole to edge distance", inch: ".020\"", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.200\" x 5.200\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: ".500\"", mm: "12.7 mm" },
                    { label: "Largest dimple", inch: "2.500\"", mm: "63.5 mm" },
                    { label: "Dimple overall height (.500\" dimple)", inch: ".135\"", mm: "3.429 mm" },
                    { label: "Dimple overall height (.750\" dimple)", inch: ".135\"", mm: "3.429 mm" },
                    { label: "Dimple overall height (1.000\" dimple)", inch: ".170\"", mm: "4.318 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".190\"", mm: "4.826 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".205\"", mm: "5.207 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".210\"", mm: "5.334 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".225\"", mm: "5.715 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".275\"", mm: "6.985 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "Please view Catalog", mm: "Please view Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Aluminum (Al): 95.9 – 98.6 Magnesium (Mg): 0.8 – 1.2 Silicon (Si): 0.4 – 0.8 Iron (Fe): 0 – 0.7 Copper (Cu): 0.15 – 0.4 Chromium (Cr): 0.040 – 0.35 Zinc (Zn): 0 – 0.25 Manganese (Mn): 0 – 0.15 Titanium (Ti): 0 – 0.15 Residuals: 0 – 0.15" },
                    { label: "Density", value: "169.344 lb/ft^3" },
                    { label: "Heat treatments process", value: "T6" },
                    { label: "ASTM", value: "B209-21" },
                    { label: "Tensile Strength (Ultimate)", value: "45 ksi" },
                    { label: "Tensile Strength (Yield)", value: "39 ksi" },
                    { label: "Shear Strength", value: "30 ksi" },
                    { label: "Shear Modulus", value: "3800 ksi" },
                    { label: "Fatigue Strength", value: "14 ksi" },
                    { label: "Brinell Hardness", value: "93" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "10000 ksi" },
                    { label: "Poisson’s Ratio", value: ".33" },
                    { label: "Thermal Conductivity", value: "170 BTU/h-ft °F" },
                    { label: "Melting Point", value: "1080 °F" },
                    { label: "Magnetic", value: "No" },
                    { label: "Does it Rust", value: "No" }
                ]
            },
            ".063\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Anodizing", "Deburring", "Dimple Forming", "Hardware Insertion", "Powder Coating", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.063\"", mm: "1.6 mm" },
                    { label: "Gauge", inch: "14", mm: "14" },
                    { label: "Thickness tolerance positive", inch: "0.004\"", mm: "0.102 mm" },
                    { label: "Thickness tolerance negative", inch: "0.004\"", mm: "0.102 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "Global", mm: "Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "0.25\" x 0.375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: "0.025\"", mm: "0.635 mm" },
                    { label: "Min bridge size", inch: "0.022\"", mm: "0.559 mm" },
                    { label: "Min hole to edge distance", inch: "0.020\"", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: "0.010\"", mm: "0.254 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 5\"", mm: "25.4 mm x 127 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.20\" x 5.20\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: "0.5\"", mm: "12.7 mm" },
                    { label: "Largest dimple", inch: "3.0\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (12.7 mm dimple)", inch: "0.157\"", mm: "3.988 mm" },
                    { label: "Dimple overall height (19.05 mm dimple)", inch: "0.155\"", mm: "3.937 mm" },
                    { label: "Dimple overall height (25.4 mm dimple)", inch: "0.195\"", mm: "4.953 mm" },
                    { label: "Dimple overall height (31.75 mm dimple)", inch: "0.201\"", mm: "5.105 mm" },
                    { label: "Dimple overall height (38.1 mm dimple)", inch: "0.228\"", mm: "5.791 mm" },
                    { label: "Dimple overall height (44.45 mm dimple)", inch: "0.232\"", mm: "5.893 mm" },
                    { label: "Dimple overall height (50.8 mm dimple)", inch: "0.250\"", mm: "6.35 mm" },
                    { label: "Dimple overall height (63.5 mm dimple)", inch: "0.305\"", mm: "7.747 mm" },
                    { label: "Dimple overall height (76.2 mm dimple)", inch: "0.370\"", mm: "9.398 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M6 x 1.0", mm: "M6 x 1.0" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.95\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.020\"", mm: "0.508 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 + 0.020\"", mm: "Tap hole size/2 + 0.508 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Aluminum (Al): 95.9 – 98.6 Magnesium (Mg): 0.8 – 1.2 Silicon (Si): 0.4 – 0.8 Iron (Fe): 0 – 0.7 Copper (Cu): 0.15 – 0.4 Chromium (Cr): 0.040 – 0.35 Zinc (Zn): 0 – 0.25 Manganese (Mn): 0 – 0.15 Titanium (Ti): 0 – 0.15 Residuals: 0 – 0.15" },
                    { label: "Density", value: "169.344 lb/ft^3" },
                    { label: "Heat treatments process", value: "T6" },
                    { label: "ASTM", value: "B209-21" },
                    { label: "Tensile Strength (Ultimate)", value: "45 ksi" },
                    { label: "Tensile Strength (Yield)", value: "39 ksi" },
                    { label: "Shear Strength", value: "30 ksi" },
                    { label: "Shear Modulus", value: "3800 ksi" },
                    { label: "Fatigue Strength", value: "14 ksi" },
                    { label: "Brinell Hardness", value: "93" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "10000 ksi" },
                    { label: "Poisson’s Ratio", value: ".33" },
                    { label: "Thermal Conductivity", value: "170 BTU/h-ft °F" },
                    { label: "Melting Point", value: "1080 °F" },
                    { label: "Magnetic", value: "No" },
                    { label: "Does it Rust", value: "No" }
                ]
            },
            ".080\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Anodizing", "Deburring", "Dimple Forming", "Hardware Insertion", "Powder Coating", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.080\"", mm: "2.032 mm" },
                    { label: "Gauge", inch: "12", mm: "12" },
                    { label: "Thickness tolerance positive", inch: "0.004\"", mm: "0.102 mm" },
                    { label: "Thickness tolerance negative", inch: "0.004\"", mm: "0.102 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "Global", mm: "Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "0.25\" x 0.375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: "0.032\"", mm: "0.813 mm" },
                    { label: "Min bridge size", inch: "0.028\"", mm: "0.711 mm" },
                    { label: "Min hole to edge distance", inch: "0.024\"", mm: "0.61 mm" },
                    { label: "Tab and slot tolerance", inch: "0.010\"", mm: "0.254 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 5\"", mm: "25.4 mm x 127 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.20\" x 5.20\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: "1.0\"", mm: "25.4 mm" },
                    { label: "Largest dimple", inch: "3.0\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (25.4 mm dimple)", inch: "0.210\"", mm: "5.334 mm" },
                    { label: "Dimple overall height (31.75 mm dimple)", inch: "0.229\"", mm: "5.817 mm" },
                    { label: "Dimple overall height (38.1 mm dimple)", inch: "0.244\"", mm: "6.198 mm" },
                    { label: "Dimple overall height (44.45 mm dimple)", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Dimple overall height (50.8 mm dimple)", inch: "0.270\"", mm: "6.858 mm" },
                    { label: "Dimple overall height (63.5 mm dimple)", inch: "0.325\"", mm: "8.255 mm" },
                    { label: "Dimple overall height (76.2 mm dimple)", inch: "0.390\"", mm: "9.906 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M6 x 1.0", mm: "M6 x 1.0" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.95\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.024\"", mm: "0.61 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 + 0.024\"", mm: "Tap hole size/2 + 0.61 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Aluminum (Al): 95.9 – 98.6 Magnesium (Mg): 0.8 – 1.2 Silicon (Si): 0.4 – 0.8 Iron (Fe): 0 – 0.7 Copper (Cu): 0.15 – 0.4 Chromium (Cr): 0.040 – 0.35 Zinc (Zn): 0 – 0.25 Manganese (Mn): 0 – 0.15 Titanium (Ti): 0 – 0.15 Residuals: 0 – 0.15" },
                    { label: "Density", value: "169.344 lb/ft^3" },
                    { label: "Heat treatments process", value: "T6" },
                    { label: "ASTM", value: "B209-21" },
                    { label: "Tensile Strength (Ultimate)", value: "45 ksi" },
                    { label: "Tensile Strength (Yield)", value: "39 ksi" },
                    { label: "Shear Strength", value: "30 ksi" },
                    { label: "Shear Modulus", value: "3800 ksi" },
                    { label: "Fatigue Strength", value: "14 ksi" },
                    { label: "Brinell Hardness", value: "93" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "10000 ksi" },
                    { label: "Poisson’s Ratio", value: ".33" },
                    { label: "Thermal Conductivity", value: "170 BTU/h-ft °F" },
                    { label: "Melting Point", value: "1080 °F" },
                    { label: "Magnetic", value: "No" },
                    { label: "Does it Rust", value: "No" }
                ]
            },
            ".100\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Anodizing", "Deburring", "Dimple Forming", "Hardware Insertion", "Powder Coating", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.100\"", mm: "2.54 mm" },
                    { label: "Gauge", inch: "12", mm: "12" },
                    { label: "Thickness tolerance positive", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Thickness tolerance negative", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA", mm: "USA" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "0.25\" x 0.375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: "0.040\"", mm: "1.016 mm" },
                    { label: "Min bridge size", inch: "0.035\"", mm: "0.889 mm" },
                    { label: "Min hole to edge distance", inch: "0.030\"", mm: "0.762 mm" },
                    { label: "Tab and slot tolerance", inch: "0.010\"", mm: "0.254 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 5\"", mm: "25.4 mm x 127 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.20\" x 5.20\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: "1.0\"", mm: "25.4 mm" },
                    { label: "Largest dimple", inch: "3.0\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (25.4 mm dimple)", inch: "0.210\"", mm: "5.334 mm" },
                    { label: "Dimple overall height (31.75 mm dimple)", inch: "0.229\"", mm: "5.817 mm" },
                    { label: "Dimple overall height (38.1 mm dimple)", inch: "0.244\"", mm: "6.198 mm" },
                    { label: "Dimple overall height (44.45 mm dimple)", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Dimple overall height (50.8 mm dimple)", inch: "0.270\"", mm: "6.858 mm" },
                    { label: "Dimple overall height (63.5 mm dimple)", inch: "0.325\"", mm: "8.255 mm" },
                    { label: "Dimple overall height (76.2 mm dimple)", inch: "0.390\"", mm: "9.906 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "31\" x 37\"", mm: "787.4 mm x 939.8 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M6 x 1.0", mm: "M6 x 1.0" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.95\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.024\"", mm: "0.61 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 + 0.024\"", mm: "Tap hole size/2 + 0.61 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Aluminum (Al): 95.9 – 98.6 Magnesium (Mg): 0.8 – 1.2 Silicon (Si): 0.4 – 0.8 Iron (Fe): 0 – 0.7 Copper (Cu): 0.15 – 0.4 Chromium (Cr): 0.040 – 0.35 Zinc (Zn): 0 – 0.25 Manganese (Mn): 0 – 0.15 Titanium (Ti): 0 – 0.15 Residuals: 0 – 0.15" },
                    { label: "Density", value: "169.344 lb/ft^3" },
                    { label: "Heat treatments process", value: "T6" },
                    { label: "ASTM", value: "B209-21" },
                    { label: "Tensile Strength (Ultimate)", value: "45 ksi" },
                    { label: "Tensile Strength (Yield)", value: "39 ksi" },
                    { label: "Shear Strength", value: "30 ksi" },
                    { label: "Shear Modulus", value: "3800 ksi" },
                    { label: "Fatigue Strength", value: "14 ksi" },
                    { label: "Brinell Hardness", value: "93" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "10000 ksi" },
                    { label: "Poisson’s Ratio", value: ".33" },
                    { label: "Thermal Conductivity", value: "170 BTU/h-ft °F" },
                    { label: "Melting Point", value: "1080 °F" },
                    { label: "Magnetic", value: "No" },
                    { label: "Does it Rust", value: "No" }
                ]
            },
            ".125\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Dimple Forming", "Hardware Insertion", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.125\"", mm: "3.175 mm" },
                    { label: "Gauge", inch: "8", mm: "8" },
                    { label: "Thickness tolerance positive", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Thickness tolerance negative", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "0.25\" x 0.375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: "0.050\"", mm: "1.27 mm" },
                    { label: "Min bridge size", inch: "0.044\"", mm: "1.118 mm" },
                    { label: "Min hole to edge distance", inch: "0.038\"", mm: "0.965 mm" },
                    { label: "Tab and slot tolerance", inch: "0.010\"", mm: "0.254 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: "0.099\"", mm: "2.515 mm" },
                    { label: "Countersink Max Major", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: "0.246\"", mm: "6.248 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.20\" x 5.20\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: "1.25\"", mm: "31.75 mm" },
                    { label: "Largest dimple", inch: "3.0\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (31.75 mm dimple)", inch: "0.265\"", mm: "6.731 mm" },
                    { label: "Dimple overall height (38.1 mm dimple)", inch: "0.285\"", mm: "7.239 mm" },
                    { label: "Dimple overall height (44.45 mm dimple)", inch: "0.303\"", mm: "7.696 mm" },
                    { label: "Dimple overall height (50.8 mm dimple)", inch: "0.311\"", mm: "7.899 mm" },
                    { label: "Dimple overall height (63.5 mm dimple)", inch: "0.365\"", mm: "9.271 mm" },
                    { label: "Dimple overall height (76.2 mm dimple)", inch: "0.440\"", mm: "11.176 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M10 x 1.5", mm: "M10 x 1.5" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.95\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.038\"", mm: "0.965 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 + 0.038\"", mm: "Tap hole size/2 + 0.965 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Aluminum (Al): 95.9 – 98.6 Magnesium (Mg): 0.8 – 1.2 Silicon (Si): 0.4 – 0.8 Iron (Fe): 0 – 0.7 Copper (Cu): 0.15 – 0.4 Chromium (Cr): 0.040 – 0.35 Zinc (Zn): 0 – 0.25 Manganese (Mn): 0 – 0.15 Titanium (Ti): 0 – 0.15 Residuals: 0 – 0.15" },
                    { label: "Density", value: "169.344 lb/ft^3" },
                    { label: "Heat treatments process", value: "T6" },
                    { label: "ASTM", value: "B209-21" },
                    { label: "Tensile Strength (Ultimate)", value: "45 ksi" },
                    { label: "Tensile Strength (Yield)", value: "39 ksi" },
                    { label: "Shear Strength", value: "30 ksi" },
                    { label: "Shear Modulus", value: "3800 ksi" },
                    { label: "Fatigue Strength", value: "14 ksi" },
                    { label: "Brinell Hardness", value: "93" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "10000 ksi" },
                    { label: "Poisson’s Ratio", value: ".33" },
                    { label: "Thermal Conductivity", value: "170 BTU/h-ft °F" },
                    { label: "Melting Point", value: "1080 °F" },
                    { label: "Magnetic", value: "No" },
                    { label: "Does it Rust", value: "No" }
                ]
            },
            ".187\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Hardware Insertion", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.187\"", mm: "4.75 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.009\"", mm: "0.229 mm" },
                    { label: "Thickness tolerance negative", inch: "0.009\"", mm: "0.229 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "Global", mm: "Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "0.5\" x 0.5\"", mm: "12.7 mm x 12.7 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Recommended Min hole size", inch: "0.075\"", mm: "1.905 mm" },
                    { label: "Min hole size", inch: "0.042\"", mm: "1.067 mm" },
                    { label: "Min bridge size", inch: "0.065\"", mm: "1.651 mm" },
                    { label: "Min hole to edge distance", inch: "0.056\"", mm: "1.422 mm" },
                    { label: "Tab and slot tolerance", inch: "0.015\"", mm: "0.381 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: "0.099\"", mm: "2.515 mm" },
                    { label: "Countersink Max Major", inch: "0.531\"", mm: "13.487 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: "0.276\"", mm: "7.01 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "4-40", mm: "4-40" },
                    { label: "Min Flat Part Size Tapping", inch: "0.95\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.056\"", mm: "1.422 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 + 0.056\"", mm: "Tap hole size/2 + 1.422 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Aluminum (Al): 95.9 – 98.6 Magnesium (Mg): 0.8 – 1.2 Silicon (Si): 0.4 – 0.8 Iron (Fe): 0 – 0.7 Copper (Cu): 0.15 – 0.4 Chromium (Cr): 0.040 – 0.35 Zinc (Zn): 0 – 0.25 Manganese (Mn): 0 – 0.15 Titanium (Ti): 0 – 0.15 Residuals: 0 – 0.15" },
                    { label: "Density", value: "169.344 lb/ft^3" },
                    { label: "Heat treatments process", value: "T6" },
                    { label: "ASTM", value: "B209-21" },
                    { label: "Tensile Strength (Ultimate) \t", value: "45 ksi" },
                    { label: "Tensile Strength (Yield)", value: "39 ksi" },
                    { label: "Shear Strength", value: "30 ksi" },
                    { label: "Shear Modulus", value: "3800 ksi" },
                    { label: "Fatigue Strength", value: "14 ksi" },
                    { label: "Brinell Hardness", value: "93" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "10000 ksi" },
                    { label: "Poisson’s Ratio", value: ".33" },
                    { label: "Thermal Conductivity", value: "170 BTU/h-ft °F" },
                    { label: "Melting Point", value: "1080 °F" },
                    { label: "Magnetic", value: "No" },
                    { label: "Does it Rust", value: "No" }
                ]
            },
            ".250\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Hardware Insertion", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.250\"", mm: "6.35 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.027\"", mm: "0.686 mm" },
                    { label: "Thickness tolerance negative", inch: "0.027\"", mm: "0.686 mm" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "Global", mm: "Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "0.5\" x 0.75\"", mm: "12.7 mm x 19.05 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Recommended Min hole size", inch: "0.088\"", mm: "2.235 mm" },
                    { label: "Min hole size", inch: "0.057\"", mm: "1.448 mm" },
                    { label: "Min bridge size", inch: "0.095\"", mm: "2.413 mm" },
                    { label: "Min hole to edge distance", inch: "0.075\"", mm: "1.905 mm" },
                    { label: "Tab and slot tolerance", inch: "0.035\"", mm: "0.889 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: "0.099\"", mm: "2.515 mm" },
                    { label: "Countersink Max Major", inch: "0.656\"", mm: "16.662 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: "0.338\"", mm: "8.585 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "4-40", mm: "4-40" },
                    { label: "Min Flat Part Size Tapping", inch: "0.95\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.075\"", mm: "1.905 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.075\"", mm: "Tap hole size/2 +1.905 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Aluminum (Al): 95.9 – 98.6 Magnesium (Mg): 0.8 – 1.2 Silicon (Si): 0.4 – 0.8 Iron (Fe): 0 – 0.7 Copper (Cu): 0.15 – 0.4 Chromium (Cr): 0.040 – 0.35 Zinc (Zn): 0 – 0.25 Manganese (Mn): 0 – 0.15 Titanium (Ti): 0 – 0.15 Residuals: 0 – 0.15" },
                    { label: "Density", value: "169.344 lb/ft^3" },
                    { label: "Heat treatments process", value: "T6" },
                    { label: "ASTM", value: "B209-21" },
                    { label: "Tensile Strength (Ultimate)", value: "45 ksi" },
                    { label: "Tensile Strength (Yield)", value: "39 ksi" },
                    { label: "Shear Strength", value: "30 ksi" },
                    { label: "Shear Modulus", value: "3800 ksi" },
                    { label: "Fatigue Strength", value: "14 ksi" },
                    { label: "Brinell Hardness", value: "93" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "10000 ksi" },
                    { label: "Poisson’s Ratio", value: ".33" },
                    { label: "Thermal Conductivity", value: "170 BTU/h-ft °F" },
                    { label: "Melting Point", value: "1080 °F" },
                    { label: "Magnetic", value: "No" },
                    { label: "Does it Rust", value: "No" }
                ]
            },
            ".313\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Hardware Insertion", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.313\"", mm: "7.95 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.014\"", mm: "0.356 mm" },
                    { label: "Thickness tolerance negative", inch: "0.014\"", mm: "0.356 mm" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "Global", mm: "Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "0.75\" x 1.0\"", mm: "19.05 mm x 25.4 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Recommended Min hole size", inch: "0.090\"", mm: "2.286 mm" },
                    { label: "Min hole size", inch: "0.075\"", mm: "1.905 mm" },
                    { label: "Min bridge size", inch: "0.125\"", mm: "3.175 mm" },
                    { label: "Min hole to edge distance", inch: "0.094\"", mm: "2.388 mm" },
                    { label: "Tab and slot tolerance", inch: "0.035\"", mm: "0.889 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: "0.099\"", mm: "2.515 mm" },
                    { label: "Countersink Max Major", inch: "0.656\"", mm: "16.662 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: "0.338\"", mm: "8.585 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "4-40", mm: "4-40" },
                    { label: "Min Flat Part Size Tapping", inch: "0.95\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.094\"", mm: "2.388 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.094\"", mm: "Tap hole size/2 +2.388 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Aluminum (Al): 95.9 – 98.6 Magnesium (Mg): 0.8 – 1.2 Silicon (Si): 0.4 – 0.8 Iron (Fe): 0 – 0.7 Copper (Cu): 0.15 – 0.4 Chromium (Cr): 0.040 – 0.35 Zinc (Zn): 0 – 0.25 Manganese (Mn): 0 – 0.15 Titanium (Ti): 0 – 0.15 Residuals: 0 – 0.15" },
                    { label: "Density", value: "169.344 lb/ft^3" },
                    { label: "Heat treatments process", value: "T6" },
                    { label: "ASTM", value: "B209-21" },
                    { label: "Tensile Strength (Ultimate)", value: "45 ksi" },
                    { label: "Tensile Strength (Yield)", value: "39 ksi" },
                    { label: "Shear Strength", value: "30 ksi" },
                    { label: "Shear Modulus", value: "3800 ksi" },
                    { label: "Fatigue Strength", value: "14 ksi" },
                    { label: "Brinell Hardness", value: "93" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "10000 ksi" },
                    { label: "Poisson’s Ratio", value: ".33" },
                    { label: "Thermal Conductivity", value: "170 BTU/h-ft °F" },
                    { label: "Melting Point", value: "1080 °F" },
                    { label: "Magnetic", value: "No" },
                    { label: "Does it Rust", value: "No" }
                ]
            },
            ".375\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Hardware Insertion", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.375\"", mm: "9.525 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.033\"", mm: "0.838 mm" },
                    { label: "Thickness tolerance negative", inch: "0.033\"", mm: "0.838 mm" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "Global", mm: "Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.005 per foot", mm: "+/-0.005 per foot" },
                    { label: "Min part size", inch: "0.75\" x 1.0\"", mm: "19.05 mm x 25.4 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Recommended Min hole size", inch: "0.131\"", mm: "3.327 mm" },
                    { label: "Min hole size", inch: "0.085\"", mm: "2.159 mm" },
                    { label: "Min bridge size", inch: "0.143\"", mm: "3.632 mm" },
                    { label: "Min hole to edge distance", inch: "0.113\"", mm: "2.87 mm" },
                    { label: "Tab and slot tolerance", inch: "0.040\"", mm: "1.016 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: "0.130\"", mm: "3.302 mm" },
                    { label: "Countersink Max Major", inch: "0.656\"", mm: "16.662 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: "0.338\"", mm: "8.585 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "8-32", mm: "8-32" },
                    { label: "Min Flat Part Size Tapping", inch: "0.95\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.113\"", mm: "2.87 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 + 0.113\"", mm: "Tap hole size/2 + 2.87 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Aluminum (Al): 95.9 – 98.6 Magnesium (Mg): 0.8 – 1.2 Silicon (Si): 0.4 – 0.8 Iron (Fe): 0 – 0.7 Copper (Cu): 0.15 – 0.4 Chromium (Cr): 0.040 – 0.35 Zinc (Zn): 0 – 0.25 Manganese (Mn): 0 – 0.15 Titanium (Ti): 0 – 0.15 Residuals: 0 – 0.15" },
                    { label: "Density", value: "169.344 lb/ft^3" },
                    { label: "Heat treatments process", value: "T6" },
                    { label: "ASTM", value: "B209-21" },
                    { label: "Tensile Strength (Ultimate)", value: "45 ksi" },
                    { label: "Tensile Strength (Yield)", value: "39 ksi" },
                    { label: "Shear Strength", value: "30 ksi" },
                    { label: "Shear Modulus", value: "3800 ksi" },
                    { label: "Fatigue Strength", value: "14 ksi" },
                    { label: "Brinell Hardness", value: "93" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "10000 ksi" },
                    { label: "Poisson’s Ratio", value: ".33" },
                    { label: "Thermal Conductivity", value: "170 BTU/h-ft °F" },
                    { label: "Melting Point", value: "1080 °F" },
                    { label: "Magnetic", value: "No" },
                    { label: "Does it Rust", value: "No" }
                ]
            },
            ".500\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Hardware Insertion", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.500\"", mm: "12.7 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.043\"", mm: "1.092 mm" },
                    { label: "Thickness tolerance negative", inch: "0.043\"", mm: "1.092 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "Global", mm: "Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "1.0\" x 1.0\"", mm: "25.4 mm x 25.4 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Recommended Min hole size", inch: "0.170\"", mm: "4.318 mm" },
                    { label: "Min hole size", inch: "0.125\"", mm: "3.175 mm" },
                    { label: "Min bridge size", inch: "0.190\"", mm: "4.826 mm" },
                    { label: "Min hole to edge distance", inch: "0.150\"", mm: "3.81 mm" },
                    { label: "Tab and slot tolerance", inch: "0.050\"", mm: "1.27 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: "0.193\"", mm: "4.902 mm" },
                    { label: "Countersink Max Major", inch: "0.656\"", mm: "16.662 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: "0.338\"", mm: "8.585 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "10-32", mm: "10-32" },
                    { label: "Min Flat Part Size Tapping", inch: "0.95\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.150\"", mm: "3.81 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 + 0.150\"", mm: "Tap hole size/2 + 3.81 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Aluminum (Al): 95.9 – 98.6 Magnesium (Mg): 0.8 – 1.2 Silicon (Si): 0.4 – 0.8 Iron (Fe): 0 – 0.7 Copper (Cu): 0.15 – 0.4 Chromium (Cr): 0.040 – 0.35 Zinc (Zn): 0 – 0.25 Manganese (Mn): 0 – 0.15 Titanium (Ti): 0 – 0.15 Residuals: 0 – 0.15" },
                    { label: "Density", value: "169.344 lb/ft^3" },
                    { label: "Heat treatments process", value: "T6" },
                    { label: "ASTM", value: "B209-21" },
                    { label: "Tensile Strength (Ultimate)", value: "45 ksi" },
                    { label: "Tensile Strength (Yield)", value: "39 ksi" },
                    { label: "Shear Strength", value: "30 ksi" },
                    { label: "Shear Modulus", value: "3800 ksi" },
                    { label: "Fatigue Strength", value: "14 ksi" },
                    { label: "Brinell Hardness", value: "93" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "10000 ksi" },
                    { label: "Poisson’s Ratio", value: ".33" },
                    { label: "Thermal Conductivity", value: "170 BTU/h-ft °F" },
                    { label: "Melting Point", value: "1080 °F" },
                    { label: "Magnetic", value: "No" },
                    { label: "Does it Rust", value: "No" }
                ]
            },
            ".625\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Hardware Insertion", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.625\"", mm: "15.875 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.023\"", mm: "0.584 mm" },
                    { label: "Thickness tolerance negative", inch: "0.023\"", mm: "0.584 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                hardwareSpecs: [
                    { label: "Hardware Compatibility", inch: "Contact Support", mm: "Contact Support" },
                    { label: "Installation Type", inch: "Press-fit", mm: "Press-fit" },
                    { label: "Min Hole to Edge", inch: "Contact Support", mm: "Contact Support" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.042 per foot", mm: "+/-0.042 per foot" },
                    { label: "Min part size", inch: "3.0\" x 3.0\"", mm: "76.2 mm x 76.2 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: "0.25\"", mm: "6.35 mm" },
                    { label: "Min bridge size", inch: "0.3\"", mm: "7.62 mm" },
                    { label: "Min hole to edge distance", inch: "0.188\"", mm: "4.775 mm" },
                    { label: "Tab and slot tolerance", inch: "0.015\"", mm: "0.381 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: "0.193\"", mm: "4.902 mm" },
                    { label: "Countersink Max Major", inch: "0.427\"", mm: "10.846 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: "0.339\"", mm: "8.611 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "5/16-18", mm: "5/16-18" },
                    { label: "Min Flat Part Size Tapping", inch: "0.95\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 36\"", mm: "914.4 mm x 914.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.188\"", mm: "4.775 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.032\"", mm: "Tap hole size/2 +0.813 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Aluminum (Al): Balance (~95.8–98.6%) Magnesium (Mg): 0.8–1.2% Silicon (Si): 0.4–0.8% Iron (Fe): 0–0.7% Copper (Cu): 0.15–0.40% Chromium (Cr): 0.04–0.35% Zinc (Zn): 0–0.25% Manganese (Mn): 0–0.15% Titanium (Ti): 0–0.15% Other Residuals (each): ≤0.05%" },
                    { label: "Density", value: "169.344 lb/ft^3" },
                    { label: "Heat treatments process", value: "N/A" },
                    { label: "ASTM", value: "B209" },
                    { label: "Tensile Strength (Ultimate)", value: "42 ksi" },
                    { label: "Tensile Strength (Yield)", value: "35 ksi" },
                    { label: "Shear Strength", value: "30 ksi" },
                    { label: "Shear Modulus", value: "3700 ksi" },
                    { label: "Fatigue Strength", value: "14 ksi" },
                    { label: "Brinell Hardness", value: "90" },
                    { label: "Elongation at Break", value: "8%" },
                    { label: "Elastic Modulus", value: "9900 ksi" },
                    { label: "Poisson’s Ratio", value: ".33" },
                    { label: "Thermal Conductivity", value: "80 BTU/h-ft °F" },
                    { label: "Melting Point", value: "1120 °F" },
                    { label: "Magnetic", value: "No" },
                    { label: "Does it Rust", value: "No" }
                ]
            },
            ".750\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Hardware Insertion", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.750\"", mm: "19.05 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.031\"", mm: "0.787 mm" },
                    { label: "Thickness tolerance negative", inch: "0.031\"", mm: "0.787 mm" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                hardwareSpecs: [
                    { label: "Hardware Compatibility", inch: "Contact Support", mm: "Contact Support" },
                    { label: "Installation Type", inch: "Press-fit", mm: "Press-fit" },
                    { label: "Min Hole to Edge", inch: "Contact Support", mm: "Contact Support" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.127 mm", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.042\" per foot", mm: "+/-1.067 mm per foot" },
                    { label: "Min part size", inch: "3.0\" x 3.0\"", mm: "76.2 mm x 76.2 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: "0.3\"", mm: "7.62 mm" },
                    { label: "Min bridge size", inch: "0.375\"", mm: "9.525 mm" },
                    { label: "Min hole to edge distance", inch: "0.225\"", mm: "5.715 mm" },
                    { label: "Tab and slot tolerance", inch: "0.015\"", mm: "0.381 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Countersink Max Major", inch: "0.427\"", mm: "10.846 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: "0.339\"", mm: "8.611 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "3/8-16", mm: "3/8-16" },
                    { label: "Min Flat Part Size Tapping", inch: "0.95\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 36\"", mm: "914.4 mm x 914.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.225\"", mm: "5.715 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.032\"", mm: "Tap hole size/2 +0.813 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Aluminum (Al): Balance (~95.8–98.6%) Magnesium (Mg): 0.8–1.2% Silicon (Si): 0.4–0.8% Iron (Fe): 0–0.7% Copper (Cu): 0.15–0.40% Chromium (Cr): 0.04–0.35% Zinc (Zn): 0–0.25% Manganese (Mn): 0–0.15% Titanium (Ti): 0–0.15% Other Residuals (each): ≤0.05%" },
                    { label: "Density", value: "169.344 lb/ft^3" },
                    { label: "Heat treatments process", value: "N/A" },
                    { label: "ASTM", value: "B209" },
                    { label: "Tensile Strength (Ultimate)", value: "42 ksi" },
                    { label: "Tensile Strength (Yield)", value: "35 ksi" },
                    { label: "Shear Strength", value: "30 ksi" },
                    { label: "Shear Modulus", value: "3700 ksi" },
                    { label: "Fatigue Strength", value: "14 ksi" },
                    { label: "Brinell Hardness", value: "90" },
                    { label: "Elongation at Break", value: "8%" },
                    { label: "Elastic Modulus", value: "9900 ksi" },
                    { label: "Poisson’s Ratio", value: ".33" },
                    { label: "Thermal Conductivity", value: "80 BTU/h-ft °F" },
                    { label: "Melting Point", value: "1120 °F" },
                    { label: "Magnetic", value: "No" },
                    { label: "Does it Rust", value: "No" }
                ]
            }
        },
        aboutSection: {
            title: "What is 6061 T6 Aluminum?",
            text: "6061 T6 Aluminum is strong and lightweight. Our laser cut 6061 aluminum is commonly found in structural applications where toughness and corrosion resistance are of high importance. That’s pretty typical for aluminum alloys in general, but what makes this 6061 series stand out is its heat-treatability. The heat-treating process, called precipitation hardening, further strengthens the alloy without robbing it of key properties.",
            image: about6061,
            featureChart: [
                { label: "Strength", rating: 5 },
                { label: "Weldability", rating: 4 },
                { label: "Formability", rating: 3 },
                { label: "Heat Treating", rating: 5 },
                { label: "Corrosion Resistance", rating: 3 },
                { label: "Toughness", rating: 3 },
                { label: "Machinability", rating: 4 },
                { label: "Strength-to-Weight Ratio", rating: 4 }
            ],
            capabilities: {
                title: "What can you make with 6061 T6 Aluminum parts?",
                text: "Many of our aluminum alloys are able to withstand tremendous amounts of vibration (also known as fatigue strength) making them perfectly suited for high-impact applications such as transportation and robotics. For any of these applications 6061 aluminum is a good middle of the road alloy, pairing the strength of 7075 with the malleability of 5052.",
                items: ["Construction", "Stressed components", "Electronics enclosures", "Automotive", "Aerospace structural", "Bicycle frames", "Industrial applications", "Robotics", "And so much more!"]
            }
        },
        faqs: [
            {
                question: "What thicknesses does DMS Engineering offer 6061 T6 Aluminum in?",
                answer: "DMS Engineering offers 6061 T6 Aluminum in 12 thickness options: .040'' (1.02mm), .063'' (1.60mm), .080 (2.03mm), .100''(2.54mm), .125'' (3.18mm), .187'' (4.75mm), .250'' (6.35mm), .313(8.0mm), .375''(9.5mm), .500'' (12.7mm), .625 (15.88), and .750 (19.05)"
            },
            {
                question: "What are the minimum and maximum sizes for cutting 6061 T6 Aluminum?",
                answer: "When ordering 6061 T6 Aluminum through DMS Engineering, there are specific size and thickness parameters to keep in mind. For instant quoting, the smallest part size available is .25\" x .375\", while the largest part supported is 30\" x 44\". For larger projects, custom quotes are available for sizes up to 30\" x 56\"."
            },
            {
                question: "What additional services are available for 6061 T6 Aluminum?",
                answer: "You can add the following services to your 6061 T6 Aluminum parts: Anodizing, Countersinking, Deburring, Dimple Forming, Hardware Insertion, Powder Coating, Tapping, and Tumbling"
            }
        ],
        services: [9, 4, 5, 6, 8, 11, 7, 12]
    },
    {
        id: 4,
        name: "7075 T6 ALUMINUM",
        thickness: "3 thicknesses: .125\" - .250\"",
        image: metal4,
        description: "One of the highest strength aluminum alloys available. Ideal for high-stress parts.",
        quickLook: {
            cutSizes: [
                { label: "A", size: ".25\" x .375\" min", action: "Instant Pricing", type: "solid" },
                { label: "B", size: "30\" x 44\" max", action: "Instant Pricing", type: "solid" },
                { label: "C", size: "30\" x 47\" max", action: "Custom Quote", type: "outline" }
            ],
            thicknesses: [
                { value: ".125\"", metric: "3.18mm" },
                { value: ".190\"", metric: "4.83mm" },
                { value: ".250\"", metric: "6.35mm" }
            ],
            tolerance: "+/- .005\""
        },
        specifications: {
            availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Hardware Insertion", "Powder Coating", "Tapping", "Tumbling"],
            generalDetails: [
                { label: "Advertised Thickness", inch: "0.125\" - 0.250\"", mm: "3.18 mm - 6.35 mm" },
                { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
            ],
            laserCuttingSpecs: [
                { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "0.762 mm per 304.8 mm" },
                { label: "Min part size", inch: "0.25\" x 0.375\"", mm: "6.35 mm x 9.525 mm" },
                { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" }
            ],
            properties: [
                { label: "Material Composition", value: "Aluminum (Al): 86.9 – 91.4 Zinc (Zn): 5.1 – 6.1 Magnesium (Mg): 2.1 – 2.9 Copper (Cu): 1.2 – 2.0 Iron (Fe): 0 – 0.5 Chromium (Cr): 0.18 – 0.28 Silicon (Si): 0 – 0.4 Manganese (Mn): 0 – 0.3 Zirconium (Zr): 0 – 0.25 Titanium (Ti): 0 – 0.2 Residuals: 0 – 0.15" },
                { label: "Density", value: "176.26 lb/ft^3" },
                { label: "Heat treatments process", value: "T6" },
                { label: "ASTM", value: "B209-21" },
                { label: "Tensile Strength (Ultimate)", value: "81 ksi" },
                { label: "Tensile Strength (Yield)", value: "69 ksi" },
                { label: "Shear Strength", value: "48 ksi" },
                { label: "Shear Modulus", value: "3800 ksi" },
                { label: "Fatigue Strength", value: "23 ksi" },
                { label: "Brinell Hardness", value: "150" },
                { label: "Elongation at Break", value: "7.9%" },
                { label: "Elastic Modulus", value: "10000 ksi" },
                { label: "Poisson’s Ratio", value: ".32" },
                { label: "Thermal Conductivity", value: "134 BTU/h-ft °F" },
                { label: "Melting Point", value: "890 °F" },
                { label: "Magnetic", value: "No" },
                { label: "Does it Rust", value: "No" }
            ]
        },
        thicknessSpecs: {
            ".125\"": {
                showcaseImages: [metal4_125_enhanced],
                availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Hardware Insertion", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.125\"", mm: "3.175 mm" },
                    { label: "Gauge", inch: "8", mm: "8" },
                    { label: "Thickness tolerance positive", inch: "0.004\"", mm: "0.1016 mm" },
                    { label: "Thickness tolerance negative", inch: "0.004\"", mm: "0.1016 mm" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: "0.25\" x 0.375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: "0.050\"", mm: "1.27 mm" },
                    { label: "Min bridge size", inch: "0.063\"", mm: "1.60 mm" },
                    { label: "Min hole to edge distance", inch: "0.038\"", mm: "0.965 mm" },
                    { label: "Tab and slot tolerance", inch: "0.010\"", mm: "0.254 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: "0.099\"", mm: "2.515 mm" },
                    { label: "Countersink Max Major", inch: "0.427\"", mm: "10.846 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: "0.246\"", mm: "6.248 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height (hardware)", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Hardware Catalog", mm: "See Hardware Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M10 x 1.5", mm: "M10 x 1.5" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.038\"", mm: "0.965 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.038\"", mm: "Tap hole size/2 +0.965 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Aluminum (Al): 86.9 – 91.4 Zinc (Zn): 5.1 – 6.1 Magnesium (Mg): 2.1 – 2.9 Copper (Cu): 1.2 – 2.0 Iron (Fe): 0 – 0.5 Chromium (Cr): 0.18 – 0.28 Silicon (Si): 0 – 0.4 Manganese (Mn): 0 – 0.3 Zirconium (Zr): 0 – 0.25 Titanium (Ti): 0 – 0.2 Residuals: 0 – 0.15" },
                    { label: "Density", value: "176.26 lb/ft^3" },
                    { label: "Heat treatments process", value: "T6" },
                    { label: "ASTM", value: "B209-21" },
                    { label: "Tensile Strength (Ultimate)", value: "81 ksi" },
                    { label: "Tensile Strength (Yield)", value: "69 ksi" },
                    { label: "Shear Strength", value: "48 ksi" },
                    { label: "Shear Modulus", value: "3800 ksi" },
                    { label: "Fatigue Strength", value: "23 ksi" },
                    { label: "Brinell Hardness", value: "150" },
                    { label: "Elongation at Break", value: "7.9%" },
                    { label: "Elastic Modulus", value: "10000 ksi" },
                    { label: "Poisson’s Ratio", value: ".32" },
                    { label: "Thermal Conductivity", value: "134 BTU/h-ft °F" },
                    { label: "Melting Point", value: "890 °F" },
                    { label: "Magnetic", value: "No" },
                    { label: "Does it Rust", value: "No" }
                ]
            },
            ".190\"": {
                showcaseImages: [metal4_190],
                availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Hardware Insertion", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.190\"", mm: "4.826 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.007\"", mm: "0.178 mm" },
                    { label: "Thickness tolerance negative", inch: "0.007\"", mm: "0.178 mm" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "0.5\" x 0.5\"", mm: "12.7 mm x 12.7 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: "0.076\"", mm: "1.93 mm" },
                    { label: "Min bridge size", inch: "0.095\"", mm: "2.413 mm" },
                    { label: "Min hole to edge distance", inch: "0.057\"", mm: "1.448 mm" },
                    { label: "Tab and slot tolerance", inch: "0.015\"", mm: "0.381 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: "0.099\"", mm: "2.515 mm" },
                    { label: "Countersink Max Major", inch: "0.531\"", mm: "13.487 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: "0.276\"", mm: "7.01 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height (hardware)", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Hardware Catalog", mm: "See Hardware Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "4-40", mm: "4-40" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 36\"", mm: "914.4 mm x 914.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.057\"", mm: "1.448 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.057\"", mm: "Tap hole size/2 +1.448 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ],
                properties: []
            },
            ".250\"": {
                showcaseImages: [metal4_250],
                availableServices: ["Laser Cutting", "Anodizing", "Countersinking", "Deburring", "Hardware Insertion", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.250\"", mm: "6.35 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.012\"", mm: "0.305 mm" },
                    { label: "Thickness tolerance negative", inch: "0.012\"", mm: "0.305 mm" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "0.5\" x 0.75\"", mm: "12.7 mm x 19.05 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Recommended Min hole size", inch: "0.090\"", mm: "2.286 mm" },
                    { label: "Min hole size", inch: "0.057\"", mm: "1.448 mm" },
                    { label: "Min bridge size", inch: "0.125\"", mm: "3.175 mm" },
                    { label: "Min hole to edge distance", inch: "0.075\"", mm: "1.905 mm" },
                    { label: "Tab and slot tolerance", inch: "0.020\"", mm: "0.508 mm" }
                ],
                anodizingSpecs: [
                    { label: "Min anodizing part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max anodizing part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                countersinkSpecs: [
                    { label: "Min countersink part size", inch: "1\" x 4\"", mm: "25.4 mm x 101.6 mm" },
                    { label: "Max countersink part size", inch: "14\" x 46\"", mm: "355.6 mm x 1168.4 mm" },
                    { label: "Countersink Min Minor", inch: "0.130\"", mm: "3.302 mm" },
                    { label: "Countersink Max Major", inch: "0.453\"", mm: "11.506 mm" },
                    { label: "Countersink Min Hole Center to Material Edge", inch: "0.338\"", mm: "8.585 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height (hardware)", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Hardware Catalog", mm: "See Hardware Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "4-40", mm: "4-40" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.075\"", mm: "1.905 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.075\"", mm: "Tap hole size/2 +1.905 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ],
                properties: []
            }
        },
        aboutSection: {
            title: "What is 7075 T6 Aluminum?",
            text: "7075 Aluminum is our toughest and strongest aluminum alloy. Like 6061 aluminum, 7075 aluminum was made for use in the aerospace industry, where it's used extensively. It's lightweight and durable, so it also lends itself to bike frames, rock climbing equipment, and other high stress environments.",
            image: about7075,
            featureChart: [
                { label: "Strength", rating: 5 },
                { label: "Corrosion Resistance", rating: 2 },
                { label: "Weldability", rating: 1 },
                { label: "Toughness", rating: 2 },
                { label: "Formability", rating: 2 },
                { label: "Machinability", rating: 1 },
                { label: "Heat Treating", rating: 5 },
                { label: "Strength-to-Weight Ratio", rating: 5 }
            ],
            capabilities: {
                title: "What can you make with 7075 T6 Aluminum parts?",
                text: "7075 sacrifices some of 5052 aluminum's workability, formability, and weldability for increased hardness, strength, and overall toughness. Still carrying the benefits of other aluminum alloys, such as lower weight and high fatigue strength, 7075 aluminum positions itself dominantly as having one of the best strength to weight ratios in any aluminum alloy.",
                items: ["Construction angles", "Automotive frames", "Bicycle frames", "Aerospace components", "High-Stress Structural", "Electronics", "Heat sinks", "Rock climbing equipment", "And so much more!"]
            }
        },
        faqs: [
            {
                question: "What thicknesses does DMS Engineering offer 7075 T6 Aluminum in?",
                answer: "DMS Engineering offers 7075 T6 Aluminum in three thickness options: .125\" (3.18mm), .190\" (4.83mm), and .250\" (6.35mm)."
            },
            {
                question: "What are the minimum and maximum sizes for cutting 7075 T6 Aluminum?",
                answer: "With DMS Engineering’s 7075 T6 Aluminum offering, you can get parts instantly quoted if they fall between .25\" x .375\" and 30\" x 44\". Custom quotes are available for sizes up to 30\" x 47\"."
            },
            {
                question: "What additional services are available for 7075 T6 Aluminum?",
                answer: "You can add the following services to your 7075 T6 Aluminum parts: Anodizing, Countersinking, Deburring, Hardware Insertion, Powder Coating, Tapping, and Tumbling"
            }
        ],
        services: [9, 4, 6, 8, 11, 7, 12]
    },
    {
        id: 5,
        name: "AR400",
        thickness: "1 thickness: .250\"",
        image: metal5,
        description: "Abrasion-resistant steel with high hardness and toughness.",
        quickLook: {
            cutSizes: [
                { label: "A", size: ".25\" x .375\" min", action: "Instant Pricing", type: "solid" },
                { label: "B", size: "30\" x 44\" max", action: "Instant Pricing", type: "solid" },
                { label: "C", size: "30\" x 56\" max", action: "Custom Quote", type: "outline" }
            ],
            thicknesses: [
                { value: ".250\"", metric: "6.35mm" }
            ],
            tolerance: "Laser cut, +/- .005\" tolerance"
        },
        specifications: {
            availableServices: ["Laser Cutting"],
            generalDetails: [
                { label: "Advertised Thickness", inch: "0.250\"", mm: "6.35 mm" },
                { label: "Gauge", inch: "N/A", mm: "N/A" },
                { label: "Thickness tolerance positive", inch: "0.040\"", mm: "1.016 mm" },
                { label: "Thickness tolerance negative", inch: "0.040\"", mm: "1.016 mm" },
                { label: "Mill Finish", inch: "Hot Rolled", mm: "Hot Rolled" },
                { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
            ],
            laserCuttingSpecs: [
                { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                { label: "Min part size", inch: ".500″ x .750″", mm: "12.7 mm x 19.05 mm" },
                { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                { label: "Min hole size", inch: ".088″", mm: "2.235 mm" },
                { label: "Min bridge size", inch: ".125″", mm: "3.175 mm" },
                { label: "Min hole to edge distance", inch: ".075″", mm: "1.905 mm" },
                { label: "Tab and slot tolerance", inch: ".050\"", mm: "1.27 mm" }
            ],
            properties: [
                { label: "Material Composition", value: "Iron (Fe): 97 Manganese (Mn): 1.5 Silicon (Si): 0.50 Chromium (Cr): 0.45 Carbon (C): 0.20 Molybdenum (Mo): 0.050 Phosphorus (P): 0.025 Sulfur (S): 0.0050" },
                { label: "Density", value: "497.66 lb/ft^3" },
                { label: "Heat treatments process", value: "Quenched" },
                { label: "Tensile Strength (Ultimate)", value: "191 ksi" },
                { label: "Tensile Strength (Yield)", value: "172 ksi" },
                { label: "Shear Strength", value: "240-260 ksi" },
                { label: "Shear Modulus", value: "12000 ksi" },
                { label: "Fatigue Strength", value: "16 ksi" },
                { label: "Brinell Hardness", value: "363-440" },
                { label: "Elongation at Break", value: "10%" },
                { label: "Elastic Modulus", value: "30000 ksi" },
                { label: "Poisson’s Ratio", value: ".29" },
                { label: "Thermal Conductivity", value: "40 BTU/h-ft °F" },
                { label: "Melting Point", value: "2500-2800°F" },
                { label: "Magnetic", value: "Yes" },
                { label: "Does it Rust", value: "Yes" }
            ]
        },
        thicknessSpecs: {
            ".250\"": {
                showcaseImages: [ar400_250_showcase],
                availableServices: ["Laser Cutting"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.250\"", mm: "6.35 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.040\"", mm: "1.016 mm" },
                    { label: "Thickness tolerance negative", inch: "0.040\"", mm: "1.016 mm" },
                    { label: "Mill Finish", inch: "Hot Rolled", mm: "Hot Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".500″ x .750″", mm: "12.7 mm x 19.05 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: ".088″", mm: "2.235 mm" },
                    { label: "Min bridge size", inch: ".125″", mm: "3.175 mm" },
                    { label: "Min hole to edge distance", inch: ".075″", mm: "1.905 mm" },
                    { label: "Tab and slot tolerance", inch: ".050\"", mm: "1.27 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Iron (Fe): 97 Manganese (Mn): 1.5 Silicon (Si): 0.50 Chromium (Cr): 0.45 Carbon (C): 0.20 Molybdenum (Mo): 0.050 Phosphorus (P): 0.025 Sulfur (S): 0.0050" },
                    { label: "Density", value: "497.66 lb/ft^3" },
                    { label: "Heat treatments process", value: "Quenched" },
                    { label: "Tensile Strength (Ultimate)", value: "191 ksi" },
                    { label: "Tensile Strength (Yield)", value: "172 ksi" },
                    { label: "Shear Strength", value: "240-260 ksi" },
                    { label: "Shear Modulus", value: "12000 ksi" },
                    { label: "Fatigue Strength", value: "16 ksi" },
                    { label: "Brinell Hardness", value: "363-440" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "30000 ksi" },
                    { label: "Poisson’s Ratio", value: ".29" },
                    { label: "Thermal Conductivity", value: "40 BTU/h-ft °F" },
                    { label: "Melting Point", value: "2500-2800°F" },
                    { label: "Magnetic", value: "Yes" },
                    { label: "Does it Rust", value: "Yes" }
                ]
            }
        },
        aboutSection: {
            title: "What is AR400?",
            text: "AR400 Steel is a high-strength, abrasion-resistant alloy that is specifically engineered to withstand wear and impact in challenging environments. It has exceptional durability and resistance to surface abrasion and gouging.\n\nYou’ll find this steel in applications such as construction machinery, mining equipment, and manufacturing components subject to continuous wear.",
            image: aboutAR400,
            featureChart: [
                { label: "Strength", rating: 5 },
                { label: "Weldability", rating: 2 },
                { label: "Formability", rating: 2 },
                { label: "Heat Treating", rating: 3 },
                { label: "Corrosion Resistance", rating: 2 },
                { label: "Toughness", rating: 4 },
                { label: "Machinability", rating: 2 },
                { label: "Strength-to-Weight Ratio", rating: 5 }
            ],
            capabilities: {
                title: "What can you make with AR400 parts?",
                text: "Laser cut AR400 plate shines with its low maintenance costs and its through-hardness, positioning it as an economical fit for large-scale mining operations and industries with high wear risk. This steel is three times stronger than mild steel and it can take almost any punishment you throw at it.",
                items: [
                    "Combat robot armor plates",
                    "Sprockets/gears",
                    "Mining chutes",
                    "Heavy equipment wear plates",
                    "Shooting targets",
                    "Recycling shredders",
                    "Heavy equipment bedliners",
                    "Log splitting blades",
                    "And so much more!"
                ]
            }
        },
        faqs: [
            {
                question: "What thicknesses does DMS Engineering offer AR400 in?",
                answer: "DMS Engineering offers AR 400 in one thickness option: .250\" (6.35mm)."
            },
            {
                question: "What are the minimum and maximum sizes for cutting AR400?",
                answer: "When ordering AR 400 through DMS Engineering, there are specific size and thickness parameters to keep in mind. For instant quoting, the smallest part size available is .25\" x .375\", while the largest part supported is 30\" x 44\". For larger projects, custom quotes are available for sizes up to 30\" x 56\"."
            },
            {
                question: "What additional services are available for AR400?",
                answer: "You can add the following services to your AR400 parts: Laser Cutting"
            }
        ]
    },
    {
        id: 6,
        name: "AR500",
        thickness: "5 thicknesses: .119\" - .500\"",
        image: metal6,
        description: "Extra-high abrasion resistance. Used in targets and heavy equipment plating.",
        quickLook: {
            cutSizes: [
                { label: "A", size: ".25\" x .375\" min", action: "Instant Pricing", type: "solid" },
                { label: "B", size: "30\" x 44\" max", action: "Instant Pricing", type: "solid" },
                { label: "C", size: "30\" x 56\" max", action: "Custom Quote", type: "outline" }
            ],
            thicknesses: [
                { value: ".119\"", metric: "3.02mm" },
                { value: ".187\"", metric: "4.75mm" },
                { value: ".250\"", metric: "6.35mm" },
                { value: ".375\"", metric: "9.53mm" },
                { value: ".500\"", metric: "12.7mm" }
            ],
            tolerance: "+/- .005\""
        },
        specifications: {
            availableServices: ["Laser Cutting"],
            generalDetails: [
                { label: "Advertised Thickness", inch: "0.119\"", mm: "3.02mm" },
                { label: "Gauge", inch: "11", mm: "11" },
                { label: "Thickness tolerance positive", inch: "0.030\"", mm: "0.762 mm" },
                { label: "Thickness tolerance negative", inch: "0.030\"", mm: "0.762 mm" },
                { label: "Mill Finish", inch: "Hot Rolled", mm: "Hot Rolled" },
                { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
            ],
            laserCuttingSpecs: [
                { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                { label: "Min hole size", inch: ".042\"", mm: "1.067 mm" },
                { label: "Min bridge size", inch: ".060\"", mm: "1.524 mm" },
                { label: "Min hole to edge distance", inch: ".036\"", mm: "0.914 mm" },
                { label: "Tab and slot tolerance", inch: ".035\"", mm: "0.889 mm" }
            ],
            properties: [
                { label: "Material Composition", value: "Iron (Fe): 95.6 Nickel (Ni): 1.0 Manganese (Mn): 0.95 Chromium (Cr): 0.75 Molybdenum (Mo): 0.75 Silicon (Si): 0.65 Carbon (C): 0.31 Phosphorus (P): 0.025 Sulfur (S): 0.0050 Boron (B): 0.0030" },
                { label: "Density", value: "497.66 lb/ft^3" },
                { label: "Heat treatments process", value: "Quenched" },
                { label: "Tensile Strength (Ultimate)", value: "235 ksi" },
                { label: "Tensile Strength (Yield)", value: "200 ksi" },
                { label: "Shear Strength", value: "225-240 ksi" },
                { label: "Shear Modulus", value: "12000 ksi" },
                { label: "Fatigue Strength", value: "16 ksi" },
                { label: "Brinell Hardness", value: "477-534" },
                { label: "Elongation at Break", value: "10%" },
                { label: "Elastic Modulus", value: "30000 ksi" },
                { label: "Poisson’s Ratio", value: ".29" },
                { label: "Thermal Conductivity", value: "40 BTU/h-ft °F" },
                { label: "Melting Point", value: "2500-2800 °F" },
                { label: "Magnetic", value: "Yes" },
                { label: "Does it Rust", value: "Yes" }
            ]
        },
        aboutSection: {
            title: "What is AR500?",
            text: "Our AR500 steel is similar to AR400 with an even higher hardness, making it more resilient and suitable for applications where extreme abrasion resistance is required. It is built to withstand the same gradual abrasion over extended periods of time, making it well suited for large machinery that endures constant wear. Like its AR counterparts, it also offers outstanding economical value by requiring little maintenance.",
            image: aboutAR500,
            featureChart: [
                { label: "Strength", rating: 5 },
                { label: "Weldability", rating: 2 },
                { label: "Formability", rating: 2 },
                { label: "Heat Treating", rating: 3 },
                { label: "Corrosion Resistance", rating: 2 },
                { label: "Toughness", rating: 3 },
                { label: "Machinability", rating: 2 },
                { label: "Strength-to-Weight Ratio", rating: 5 }
            ],
            capabilities: {
                title: "What can you make with AR500 parts?",
                text: "High through-hardness is also present in this material, which means that as the wearing action begins to remove some of the surface layer, the quality of abrasion resistance remains constant. Choose AR500 steel when you are laser cutting parts in high impact applications.",
                items: [
                    "Combat robot armor plates",
                    "Shooting targets",
                    "Aerospace structural supports",
                    "Sprockets/gears",
                    "Heavy equipment bed liners",
                    "Furniture frames",
                    "Heavy equipment wear plates",
                    "Chassis components",
                    "And so much more!"
                ]
            }
        },
        faqs: [
            {
                question: "What thicknesses does DMS Engineering offer AR500 in?",
                answer: "DMS Engineering offers AR 500 in five thickness options: .119\" (3.02mm), .187\" (4.75mm), .250\" (6.35mm), .375\"(9.5mm), .500\" (12.7mm)."
            },
            {
                question: "What are the minimum and maximum sizes for cutting AR500?",
                answer: "AR 500 is available at DMS Engineering with a range of thicknesses and part sizes. Instant quoting is possible for dimensions between .25\" x .375\" and 13\" x 44\". For larger projects, custom quotes are available for sizes up to 30\" x 56\"."
            },
            {
                question: "What additional services are available for AR500?",
                answer: "You can add the following services to your AR500 parts: Laser Cutting"
            }
        ],
        thicknessSpecs: {
            ".119\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.119\"", mm: "3.02mm" },
                    { label: "Gauge", inch: "11", mm: "11" },
                    { label: "Thickness tolerance positive", inch: "0.030\"", mm: "0.762 mm" },
                    { label: "Thickness tolerance negative", inch: "0.030\"", mm: "0.762 mm" },
                    { label: "Mill Finish", inch: "Hot Rolled", mm: "Hot Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Min hole size", inch: ".042\"", mm: "1.067 mm" },
                    { label: "Min bridge size", inch: ".060\"", mm: "1.524 mm" },
                    { label: "Min hole to edge distance", inch: ".036\"", mm: "0.914 mm" },
                    { label: "Tab and slot tolerance", inch: ".035\"", mm: "0.889 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Iron (Fe): 95.6 Nickel (Ni): 1.0 Manganese (Mn): 0.95 Chromium (Cr): 0.75 Molybdenum (Mo): 0.75 Silicon (Si): 0.65 Carbon (C): 0.31 Phosphorus (P): 0.025 Sulfur (S): 0.0050 Boron (B): 0.0030" },
                    { label: "Density", value: "497.66 lb/ft^3" },
                    { label: "Heat treatments process", value: "Quenched" },
                    { label: "Tensile Strength (Ultimate)", value: "235 ksi" },
                    { label: "Tensile Strength (Yield)", value: "200 ksi" },
                    { label: "Shear Strength", value: "225-240 ksi" },
                    { label: "Shear Modulus", value: "12000 ksi" },
                    { label: "Fatigue Strength", value: "16 ksi" },
                    { label: "Brinell Hardness", value: "477-534" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "30000 ksi" },
                    { label: "Poisson’s Ratio", value: ".29" },
                    { label: "Thermal Conductivity", value: "40 BTU/h-ft °F" },
                    { label: "Melting Point", value: "2500-2800 °F" },
                    { label: "Magnetic", value: "Yes" },
                    { label: "Does it Rust", value: "Yes" }
                ]
            },
            ".187\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.187\"", mm: "4.75mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.040\"", mm: "1.016 mm" },
                    { label: "Thickness tolerance negative", inch: "0.040\"", mm: "1.016 mm" },
                    { label: "Mill Finish", inch: "Hot Rolled", mm: "Hot Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Recommended Min hole size", inch: ".065\"", mm: "1.651 mm" },
                    { label: "Min hole size", inch: ".042\"", mm: "1.067 mm" },
                    { label: "Min bridge size", inch: ".065\"", mm: "1.651 mm" },
                    { label: "Min hole to edge distance", inch: ".056\"", mm: "1.422 mm" },
                    { label: "Tab and slot tolerance", inch: ".050\"", mm: "1.27 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Iron (Fe): 95.6 Nickel (Ni): 1.0 Manganese (Mn): 0.95 Chromium (Cr): 0.75 Molybdenum (Mo): 0.75 Silicon (Si): 0.65 Carbon (C): 0.31 Phosphorus (P): 0.025 Sulfur (S): 0.0050 Boron (B): 0.0030" },
                    { label: "Density", value: "497.66 lb/ft^3" },
                    { label: "Heat treatments process", value: "Quenched" },
                    { label: "Tensile Strength (Ultimate)", value: "235 ksi" },
                    { label: "Tensile Strength (Yield)", value: "200 ksi" },
                    { label: "Shear Strength", value: "225-240 ksi" },
                    { label: "Shear Modulus", value: "1200 ksi" },
                    { label: "Fatigue Strength", value: "16 ksi" },
                    { label: "Brinell Hardness", value: "477-534" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "30000 ksi" },
                    { label: "Poisson’s Ratio", value: ".29" },
                    { label: "Thermal Conductivity", value: "40 BTU/h-ft °F" },
                    { label: "Melting Point", value: "2500-2800 °F" },
                    { label: "Magnetic", value: "Yes" },
                    { label: "Does it Rust", value: "Yes" }
                ]
            },
            ".250\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.250\"", mm: "6.35mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.040\"", mm: "1.016 mm" },
                    { label: "Thickness tolerance negative", inch: "0.040\"", mm: "1.016 mm" },
                    { label: "Mill Finish", inch: "Hot Rolled", mm: "Hot Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".500\" x .750\"", mm: "12.7 mm x 19.05 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Recommended Min hole size", inch: ".088\"", mm: "2.235 mm" },
                    { label: "Min hole size", inch: ".057\"", mm: "1.448 mm" },
                    { label: "Min bridge size", inch: ".125\"", mm: "3.175 mm" },
                    { label: "Min hole to edge distance", inch: ".075\"", mm: "1.905 mm" },
                    { label: "Tab and slot tolerance", inch: ".050\"", mm: "1.27 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Iron (Fe): 95.6 Nickel (Ni): 1.0 Manganese (Mn): 0.95 Chromium (Cr): 0.75 Molybdenum (Mo): 0.75 Silicon (Si): 0.65 Carbon (C): 0.31 Phosphorus (P): 0.025 Sulfur (S): 0.0050 Boron (B): 0.0030" },
                    { label: "Density", value: "497.66 lb/ft^3" },
                    { label: "Heat treatments process", value: "Quenched" },
                    { label: "Tensile Strength (Ultimate)", value: "235 ksi" },
                    { label: "Tensile Strength (Yield)", value: "200 ksi" },
                    { label: "Shear Strength", value: "225-240 ksi" },
                    { label: "Shear Modulus", value: "12000 ksi" },
                    { label: "Fatigue Strength", value: "16 ksi" },
                    { label: "Brinell Hardness", value: "477-534" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "30000 ksi" },
                    { label: "Poisson’s Ratio", value: ".29" },
                    { label: "Thermal Conductivity", value: "40 BTU/h-ft °F" },
                    { label: "Melting Point", value: "2500-2800 °F" },
                    { label: "Magnetic", value: "Yes" },
                    { label: "Does it Rust", value: "Yes" }
                ]
            },
            ".500\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.500\"", mm: "12.7mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.040\"", mm: "1.016 mm" },
                    { label: "Thickness tolerance negative", inch: "0.040\"", mm: "1.016 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: "1.00\" x 1.00\"", mm: "25.4 mm x 25.4 mm" },
                    { label: "Max part size", inch: "56″ x 30″", mm: "1422.4 mm x 762 mm" },
                    { label: "Recommended Min hole size", inch: ".250\"", mm: "6.35 mm" },
                    { label: "Min hole size", inch: ".125\"", mm: "3.175 mm" },
                    { label: "Min bridge size", inch: ".250\"", mm: "6.35 mm" },
                    { label: "Min hole to edge distance", inch: ".150\"", mm: "3.81 mm" },
                    { label: "Tab and slot tolerance", inch: ".050\"", mm: "1.27 mm" }
                ],
                properties: [
                    { label: "Material Composition", value: "Iron (Fe): 95.6 Nickel (Ni): 1.0 Manganese (Mn): 0.95 Chromium (Cr): 0.75 Molybdenum (Mo): 0.75 Silicon (Si): 0.65 Carbon (C): 0.31 Phosphorus (P): 0.025 Sulfur (S): 0.0050 Boron (B): 0.0030" },
                    { label: "Density", value: "497.66 lb/ft^3" },
                    { label: "Heat treatments process", value: "Quenched" },
                    { label: "Tensile Strength (Ultimate)", value: "235 ksi" },
                    { label: "Tensile Strength (Yield)", value: "200 ksi" },
                    { label: "Shear Strength", value: "225-240 ksi" },
                    { label: "Shear Modulus", value: "12000 ksi" },
                    { label: "Fatigue Strength", value: "16 ksi" },
                    { label: "Brinell Hardness", value: "477-534" },
                    { label: "Elongation at Break", value: "10%" },
                    { label: "Elastic Modulus", value: "30000 ksi" },
                    { label: "Poisson’s Ratio", value: ".29" },
                    { label: "Thermal Conductivity", value: "40 BTU/h-ft °F" },
                    { label: "Melting Point", value: "2500-2800 °F" },
                    { label: "Magnetic", value: "Yes" },
                    { label: "Does it Rust", value: "Yes" }
                ]
            }
        }
    },
    {
        id: 7,
        name: "1075 BLUE TEMPER SPRING STEEL",
        thickness: "1 thickness: .015\"",
        image: metal7,
        description: "High-carbon steel hardened for spring applications.",
        quickLook: {
            cutSizes: [
                { label: "A", size: ".25\" x .375\" min", action: "Instant Pricing", type: "solid" },
                { label: "B", size: "13\" x 44\" max", action: "Instant Pricing", type: "solid" },
                { label: "C", size: "13\" x 56\" max", action: "Custom Quote", type: "outline" }
            ],
            thicknesses: [
                { val: ".015\"", metric: ".38mm" }
            ],
            tolerance: "+/- .005\""
        },
        specifications: {
            availableServices: ["Laser Cutting"],
            generalDetails: [
                { label: "Advertised Thickness", inch: "0.015\"", mm: "0.381 mm" },
                { label: "Gauge", inch: "N/A", mm: "N/A" },
                { label: "Thickness tolerance positive", inch: "0.002\"", mm: "0.0508 mm" },
                { label: "Thickness tolerance negative", inch: "0.002\"", mm: "0.0508 mm" },
                { label: "Mill Finish", inch: "Blue Temper Scaleless", mm: "Blue Temper Scaleless" },
                { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
            ],
            laserCuttingSpecs: [
                { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                { label: "Min part size", inch: "0.25″ x 0.375″", mm: "6.35 mm x 9.525 mm" },
                { label: "Max part size", inch: "44″ x 13″", mm: "1117.6 mm x 330.2 mm" },
                { label: "Min hole size", inch: "0.015″", mm: "0.381 mm" },
                { label: "Min bridge size", inch: "0.015″", mm: "0.381 mm" },
                { label: "Min hole to edge distance", inch: "0.005″", mm: "0.127 mm" },
                { label: "Tab and slot tolerance", inch: "0.010\"", mm: "0.254 mm" }
            ],
            properties: [
                { label: "Material Composition", value: "Iron (Fe): 98% Carbon (C): 0.69% to 0.80% Manganese (Mn): 0.40% to 0.80% Phosphorus (P): 0.020% maximum Sulfur (S): 0.025% maximum Silicon (Si): 0.15% to 0.30%" },
                { label: "Density", value: "490 lb/ft^3" },
                { label: "Heat treatments process", value: "Tempered" },
                { label: "ASTM", value: "A682" },
                { label: "Tensile Strength (Ultimate)", value: "220-250 ksi" },
                { label: "Tensile Strength (Yield)", value: "150-160 ksi" },
                { label: "Shear Strength", value: "138-187 ksi" },
                { label: "Shear Modulus", value: "11000-12000 ksi" },
                { label: "Fatigue Strength", value: "70-125 ksi" },
                { label: "Brinell Hardness", value: "240-265" },
                { label: "Elongation at Break", value: "12%" },
                { label: "Elastic Modulus", value: "29000 ksi" },
                { label: "Poisson’s Ratio", value: ".30" },
                { label: "Thermal Conductivity", value: "43 BTU/h-ft °F" },
                { label: "Melting Point", value: "2500 °F" },
                { label: "Magnetic", value: "Yes" },
                { label: "Does it Rust", value: "Yes" }
            ]
        },
        aboutSection: {
            title: "What is 1075 Spring Steel?",
            text: "1075 blue tempered spring steel is a type of high-carbon steel renowned for its exceptional resilience, strength, and durability. The “blue temper” refers to the process of heating the steel to a specific temperature and then cooling it rapidly to achieve optimal hardness and toughness. This steel is characterized by its ability to resist deformation and return to its original shape after being subjected to stress, making it ideal for applications requiring reliable spring properties.",
            image: about1075,
            featureChart: [
                { label: "Strength", rating: 4 },
                { label: "Weldability", rating: 2 },
                { label: "Formability", rating: 2 },
                { label: "Heat Treating", rating: 5 },
                { label: "Corrosion Resistance", rating: 2 },
                { label: "Toughness", rating: 4 },
                { label: "Machinability", rating: 3 },
                { label: "Strength-to-Weight Ratio", rating: 4 }
            ],
            capabilities: {
                title: "What can you make with 1075 Spring Steel parts?",
                text: "1075 Blue Temper Spring Steel is a versatile steel that isn't just for springs, clamps, and coils. It's often used in blade-making as well. It's able to hold its edge well and is receptive to sharpening. It also has much better workability and toughness than something with a higher carbon count (like 1095).",
                items: ["Trap Springs", "Shims", "Tillage tools", "Snap Springs", "Clamps", "Suspension components", "S-tines", "Punches and chisels"]
            }
        },
        faqs: [
            {
                question: "What thicknesses does DMS Engineering offer 1075 Spring Steel in?",
                answer: "DMS Engineering offers Blue Temper Steel in one thickness option: .015\" (.381mm)."
            },
            {
                question: "What are the minimum and maximum sizes for cutting 1075 Spring Steel?",
                answer: "When working with Blue Temper Steel at DMS Engineering, there are specific size and thickness parameters to keep in mind. For instant quoting, the smallest part size available is .25\" x .375\", while the largest part supported is 13\" x 44\". For larger projects, custom quotes are available for sizes up to 13\" x 56\"."
            },
            {
                question: "What additional services are available for 1075 Spring Steel?",
                answer: "DMS Engineering's 1075 Blue Temper Steel is not eligible for any secondary services."
            }
        ],
    },
    {
        id: 8,
        name: "BRASS",
        thickness: "5 thicknesses: .040\" - .250\"",
        image: metal8,
        description: "Excellent decorative appeal and low friction. Used for gears, bearings, and ornamental projects.",
        services: [3, 9, 7, 12],
        quickLook: {
            cutSizes: [
                { label: "A", size: ".25\" x .375\" min", action: "Instant Pricing", type: "solid" },
                { label: "B", size: "30\" x 44\" max", action: "Instant Pricing", type: "solid" },
                { label: "C", size: "30\" x 44\" max", action: "Custom Quote", type: "outline" }
            ],
            thicknesses: [
                { value: ".040\"", metric: "1.02mm" },
                { value: ".063\"", metric: "1.60mm" },
                { value: ".125\"", metric: "3.18mm" },
                { value: ".187\"", metric: "4.75mm" },
                { value: ".250\"", metric: "6.35mm" }
            ],
            tolerance: "+/- .005\""
        },
        specifications: {
            availableServices: ["Laser Cutting", "Bending", "Deburring", "Tapping", "Tumbling"],
            generalDetails: [
                { label: "Material Type", inch: "Brass (C260)", mm: "Brass (C260)" },
                { label: "ASTM Specification", inch: "ASTM B36", mm: "ASTM B36" },
                { label: "Temper", inch: "Half Hard (H02)", mm: "Half Hard (H02)" },
                { label: "Surface Finish", inch: "Smooth Mill", mm: "Smooth Mill" }
            ],
            laserCuttingSpecs: [
                { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                { label: "Max part size", inch: "30\" x 44\"", mm: "762 mm x 1117.6 mm" }
            ],
            properties: [
                { label: "Material Composition", value: "Copper (Cu): 68.5 - 71.5% Zinc (Zn): 28.5 - 31.5% Lead (Pb): 0.07% max Iron (Fe): 0.05% max Phosphorus (P): 0.07% max Residuals: 0.5% max" },
                { label: "Density", value: "535.680 lb/ft^3" },
                { label: "Melting Point", value: "1990 °F" },
                { label: "Tensile Strength (Yield)", value: "18 ksi" },
                { label: "Tensile Strength (Ultimate)", value: "43 ksi" },
                { label: "Shear Strength", value: "29 ksi" },
                { label: "Shear Modulus", value: "6 ksi" },
                { label: "Elastic Modulus", value: "15000 ksi" },
                { label: "Poisson’s Ratio", value: ".34" },
                { label: "Thermal Conductivity", value: "67.7 BTU/h-ft °F" },
                { label: "Magnetic", value: "No" },
                { label: "Does it Rust", value: "No" },
                { label: "Brinell Hardness", value: "80" },
                { label: "Elongation at Break", value: "55%" }
            ]
        },
        thicknessSpecs: {
            ".040\"": {
                showcaseImages: [brass_showcase],
                availableServices: ["Laser Cutting", "Bending"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.040\"", mm: "1.02 mm" },
                    { label: "Gauge", inch: "18", mm: "18" },
                    { label: "Thickness tolerance positive", inch: "0.002\"", mm: "0.051 mm" },
                    { label: "Thickness tolerance negative", inch: "0.002\"", mm: "0.051 mm" },
                    { label: "Mill Finish", inch: "N/A", mm: "N/A" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".016\"", mm: "0.406 mm" },
                    { label: "Min bridge size", inch: ".020\"", mm: "0.508 mm" },
                    { label: "Min hole to edge distance", inch: ".020\"", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.292\"", mm: "7.417 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "0.332\"", mm: "8.433 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.040\"", mm: "1.016 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24\"", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24\"", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.074\"", mm: "1.88 mm" },
                    { label: "K Factor", inch: "0.38", mm: "0.38" },
                    { label: "Bend relief depth", inch: "0.100\"", mm: "2.54 mm" },
                    { label: "Min joggle (Bend line to bend line @90°)", inch: "0.299\"", mm: "7.595 mm" },
                    { label: "Max joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ]
            },
            ".063\"": {
                showcaseImages: [brass_showcase],
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.063\"", mm: "1.60 mm" },
                    { label: "Gauge", inch: "14", mm: "14" },
                    { label: "Thickness tolerance positive", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Thickness tolerance negative", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Mill Finish", inch: "N/A", mm: "N/A" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".025\"", mm: "0.635 mm" },
                    { label: "Min bridge size", inch: ".032\"", mm: "0.813 mm" },
                    { label: "Min hole to edge distance", inch: ".020\"", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.308\"", mm: "7.823 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "0.332\"", mm: "8.433 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.040\"", mm: "1.016 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24\"", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24\"", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.105\"", mm: "2.667 mm" },
                    { label: "K Factor", inch: "0.38", mm: "0.38" },
                    { label: "Bend relief depth", inch: "0.123\"", mm: "3.124 mm" },
                    { label: "Min joggle (Bend line to bend line @90°)", inch: "0.324\"", mm: "8.23 mm" },
                    { label: "Max joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M6 x 1.0", mm: "M6 x 1.0" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.020\"", mm: "0.508 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.020\"", mm: "Tap hole size/2 +0.508 mm" }
                ]
            },
            ".125\"": {
                showcaseImages: [brass_showcase],
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.125\"", mm: "3.18 mm" },
                    { label: "Gauge", inch: "8", mm: "8" },
                    { label: "Thickness tolerance positive", inch: "0.008\"", mm: "0.203 mm" },
                    { label: "Thickness tolerance negative", inch: "0.008\"", mm: "0.203 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".045\"", mm: "1.143 mm" },
                    { label: "Min bridge size", inch: ".045\"", mm: "1.143 mm" },
                    { label: "Min hole to edge distance", inch: ".038\"", mm: "0.965 mm" },
                    { label: "Tab and slot tolerance", inch: ".015\"", mm: "0.381 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.368\"", mm: "9.347 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.471\"", mm: "11.963 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "0.478\"", mm: "12.141 mm" },
                    { label: "Die width", inch: "0.630\"", mm: "16.002 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.060\"", mm: "1.524 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24\"", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24\"", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.205\"", mm: "5.207 mm" },
                    { label: "K Factor", inch: "0.36", mm: "0.36" },
                    { label: "Bend relief depth", inch: "0.205\"", mm: "5.207 mm" },
                    { label: "Min joggle (Bend line to bend line @90°)", inch: "0.506\"", mm: "12.852 mm" },
                    { label: "Max joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M10 x 1.5", mm: "M10 x 1.5" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 36\"", mm: "914.4 mm x 914.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.038\"", mm: "0.965 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.038\"", mm: "Tap hole size/2 +0.965 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".187\"": {
                showcaseImages: [brass_showcase],
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.187\"", mm: "4.75 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.010\"", mm: "0.254 mm" },
                    { label: "Thickness tolerance negative", inch: "0.010\"", mm: "0.254 mm" },
                    { label: "Mill Finish", inch: "N/A", mm: "N/A" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".055\"", mm: "1.397 mm" },
                    { label: "Min bridge size", inch: ".055\"", mm: "1.397 mm" },
                    { label: "Min hole to edge distance", inch: ".056\"", mm: "1.422 mm" },
                    { label: "Tab and slot tolerance", inch: ".015\"", mm: "0.381 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.620\"", mm: "15.748 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.782\"", mm: "19.863 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "N/A", mm: "N/A" },
                    { label: "Die width", inch: "0.984\"", mm: "24.994 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.095\"", mm: "2.413 mm" },
                    { label: "Max bend angle", inch: "90°", mm: "90°" },
                    { label: "Bend angle tolerance (up to 24\"", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24\"", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.324\"", mm: "8.23 mm" },
                    { label: "K Factor", inch: "0.38", mm: "0.38" },
                    { label: "Bend relief depth", inch: "0.302\"", mm: "7.671 mm" },
                    { label: "Min joggle (Bend line to bend line @90°)", inch: "0.826\"", mm: "20.98 mm" },
                    { label: "Max joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.056\"", mm: "1.422 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.056\"", mm: "Tap hole size/2 +1.422 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".250\"": {
                showcaseImages: [brass_showcase],
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.250\"", mm: "6.35 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.012\"", mm: "0.305 mm" },
                    { label: "Thickness tolerance negative", inch: "0.012\"", mm: "0.305 mm" },
                    { label: "Mill Finish", inch: "N/A", mm: "N/A" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".089\"", mm: "2.261 mm" },
                    { label: "Min bridge size", inch: ".100\"", mm: "2.54 mm" },
                    { label: "Min hole to edge distance", inch: ".075\"", mm: "1.905 mm" },
                    { label: "Tab and slot tolerance", inch: ".020\"", mm: "0.508 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "1.150\"", mm: "29.21 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "1.362\"", mm: "34.595 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "N/A", mm: "N/A" },
                    { label: "Die width", inch: "1.575\"", mm: "40.005 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.130\"", mm: "3.302 mm" },
                    { label: "Max bend angle", inch: "90°", mm: "90°" },
                    { label: "Bend angle tolerance (up to 24\"", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24\"", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.424\"", mm: "10.77 mm" },
                    { label: "K Factor", inch: "0.38", mm: "0.38" },
                    { label: "Bend relief depth", inch: "0.400\"", mm: "10.16 mm" },
                    { label: "Min joggle (Bend line to bend line @90°)", inch: "1.425\"", mm: "36.195 mm" },
                    { label: "Max joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "4-40", mm: "4-40" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.075\"", mm: "1.905 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.075\"", mm: "Tap hole size/2 +1.905 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            }
        },
        aboutSection: {
            title: "What is Brass?",
            text: "Our laser cut brass is gorgeous, easy to form, bend, and machine. This makes it the perfect material for your smaller hinges, locks, and other fasteners well-suited to brass usage. Brass prevents bacterial growth due to its innate antimicrobial properties. It's great for applications that are exposed to handling, such as bathroom fixtures.",
            image: brass_about,
            featureChart: [
                { label: "Strength", rating: 3 },
                { label: "Corrosion Resistance", rating: 4 },
                { label: "Weldability", rating: 1 },
                { label: "Machinability", rating: 4 },
                { label: "Toughness", rating: 2 },
                { label: "Formability", rating: 4 },
                { label: "Heat Treating", rating: 2 },
                { label: "Strength-to-Weight Ratio", rating: 2 }
            ],
            capabilities: {
                title: "What can you make with Brass parts?",
                text: "Additionally, unlike steel and iron, brass will not rust when used in external applications, and that makes it great for signage and decorative displays. However, if you intend to use it this way, it's important to note that it will corrode with moisture, specifically in the form of tarnish. Brass is a combination of copper and zinc (with a few other trace elements), and the tarnishing effect is similar to copper. DMS Engineering's brass cutting service will provide beautiful parts made to your specifications.",
                items: ["Locks", "Hinges", "Gears", "Bearings", "Valves", "Electrical sockets", "Hose couplings", "Ammunition casings", "And so much more!"]
            }
        },
        faqs: [
            {
                question: "What thicknesses does DMS Engineering offer Brass in?",
                answer: "DMS Engineering offers Brass in five thickness options: .040\" (1.02mm), .063\" (1.60mm), .125\" (3.18mm), .187\" (4.75mm), .250\" (6.35mm)."
            },
            {
                question: "What are the minimum and maximum sizes for cutting Brass?",
                answer: "When ordering Brass through DMS Engineering, there are specific size and thickness parameters to keep in mind. For instant quoting, the smallest part size available is .25\" x .375\", while the largest part supported is 30\" x 44\"."
            },
            {
                question: "What additional services are available for Brass?",
                answer: "You can add the following services to your Brass parts: Bending, Deburring, Tapping, and Tumbling."
            }
        ]
    },
    {
        id: 9,
        name: "4130 CHROMOLY",
        thickness: "5 thicknesses: .050\" - .250\"",
        image: metal9,
        description: "High strength-to-weight ratio and excellent weldability. Common in racing frames.",
        services: [3, 10, 11, 12],
        quickLook: {
            cutSizes: [
                { label: "A", size: ".25\" x .375\" min", action: "Instant Pricing", type: "solid" },
                { label: "B", size: "30\" x 44\" max", action: "Instant Pricing", type: "solid" },
                { label: "C", size: "30\" x 56\" max", action: "Custom Quote", type: "outline" }
            ],
            thicknesses: [
                { value: ".050\"", metric: "1.27mm" },
                { value: ".063\"", metric: "1.60mm" },
                { value: ".125\"", metric: "3.18mm" },
                { value: ".190\"", metric: "4.83mm" },
                { value: ".250\"", metric: "6.35mm" }
            ],
            tolerance: "+/- .005\""
        },
        specifications: {
            availableServices: ["Laser Cutting", "Bending", "Plating", "Powder Coating", "Tumbling"],
            generalDetails: [
                { label: "Material", inch: "4130 CHROMOLY", mm: "4130 CHROMOLY" },
                { label: "ASTM Specification", inch: "A505/506", mm: "A505/506" },
                { label: "Heat Treatment", inch: "Annealed/spheroidized", mm: "Annealed/spheroidized" },
                { label: "Surface Finish", inch: "Hot Rolled Finished in Oil", mm: "Hot Rolled Finished in Oil" }
            ],
            laserCuttingSpecs: [
                { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                { label: "Max part size", inch: "44″ x 30″", mm: "1117.6 mm x 762 mm" }
            ],
            properties: [
                { label: "Material Composition", value: "Chromium (Cr): 0.8 – 1.1 Manganese (Mn): 0.4 – 0.6 Carbon (C): 0.28 – 0.33 Silicon (Si): 0.15 – 0.35 Molybdenum (Mo): 0.15 – 0.25 Sulfur (S): 0 – 0.040 Phosphorus (P): 0 – 0.035" },
                { label: "Density", value: "490 lb/ft^3" },
                { label: "Heat treatments process", value: "Annealed/spheroidized" },
                { label: "ASTM", value: "A505/506" },
                { label: "Tensile Strength (Ultimate)", value: "77-150 ksi" },
                { label: "Tensile Strength (Yield)", value: "63-140 ksi" },
                { label: "Shear Strength", value: "49-93 ksi" },
                { label: "Shear Modulus", value: "11000 ksi" },
                { label: "Fatigue Strength", value: "47-93 ksi" },
                { label: "Brinell Hardness", value: "135-140" },
                { label: "Elongation at Break", value: "15%" },
                { label: "Elastic Modulus", value: "27000 ksi" },
                { label: "Poisson’s Ratio", value: ".29" },
                { label: "Thermal Conductivity", value: "26.5 BTU/h-ft °F" },
                { label: "Melting Point", value: "2599 °F" },
                { label: "Magnetic", value: "Yes" },
                { label: "Does it Rust", value: "Yes" }
            ]
        },
        thicknessSpecs: {
            ".050\"": {
                availableServices: ["Laser Cutting", "Bending", "Powder Coating"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.050\"", mm: "1.27 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.003\"", mm: "0.076 mm" },
                    { label: "Thickness tolerance negative", inch: "0.003\"", mm: "0.076 mm" },
                    { label: "Mill Finish", inch: "Hot Rolled Finished in Oil", mm: "Hot Rolled Finished in Oil" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25″ x .375″", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44″ x 30″", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".020″", mm: "0.508 mm" },
                    { label: "Min bridge size", inch: ".025″", mm: "0.635 mm" },
                    { label: "Min hole to edge distance", inch: ".020″", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before bend/Flat Pattern) 90° or less (obtuse)", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after bend) 90° or less (obtuse)", inch: "0.303\"", mm: "7.696 mm" },
                    { label: "Minimum Length Center of bend line 91-130* (Acute)", inch: "0.332\"", mm: "8.433 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.050\"", mm: "1.27 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (bend length up to 24″)", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (bend length over 24″)", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.095\"", mm: "2.413 mm" },
                    { label: "K Factor", inch: "0.38", mm: "0.38" },
                    { label: "Bend relief depth", inch: "0.120\"", mm: "3.048 mm" },
                    { label: "Minimum joggle. Bend line to bend line @90° max flange", inch: "0.310\"", mm: "7.874 mm" },
                    { label: "Maximum joggle. Bend line to bend line @90° max flange", inch: "3.750\"", mm: "95.25 mm" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1″ x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23″ x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ]
            },
            ".063\"": {
                availableServices: ["Laser Cutting", "Bending", "Powder Coating"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.063\"", mm: "1.60 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Thickness tolerance negative", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Mill Finish", inch: "Hot Rolled Finished in Oil", mm: "Hot Rolled Finished in Oil" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25″ x .375″", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44″ x 30″", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".030″", mm: "0.762 mm" },
                    { label: "Min bridge size", inch: ".032″", mm: "0.813 mm" },
                    { label: "Min hole to edge distance", inch: ".020″", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before bend/Flat Pattern) 90° or less (obtuse)", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after bend) 90° or less (obtuse)", inch: "0.303\"", mm: "7.696 mm" },
                    { label: "Minimum Length Center of bend line 91-130* (Acute)", inch: "0.332\"", mm: "8.433 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.050\"", mm: "1.27 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (bend length up to 24″)", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (bend length over 24″)", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.1065\"", mm: "2.705 mm" },
                    { label: "K Factor", inch: "0.41", mm: "0.41" },
                    { label: "Bend relief depth", inch: "0.133\"", mm: "3.378 mm" },
                    { label: "Minimum joggle. Bend line to bend line @90° max flange", inch: "0.324\"", mm: "8.230 mm" },
                    { label: "Maximum joggle. Bend line to bend line @90° max flange", inch: "3.750\"", mm: "95.25 mm" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ]
            },
            ".125\"": {
                availableServices: ["Laser Cutting", "Bending", "Powder Coating", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.125\"", mm: "3.18 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.009\"", mm: "0.229 mm" },
                    { label: "Thickness tolerance negative", inch: "0.009\"", mm: "0.229 mm" },
                    { label: "Mill Finish", inch: "Hot Rolled Finished in Oil", mm: "Hot Rolled Finished in Oil" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25″ x .375″", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44″ x 30″", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".050″", mm: "1.27 mm" },
                    { label: "Min bridge size", inch: ".063″", mm: "1.60 mm" },
                    { label: "Min hole to edge distance", inch: ".038″", mm: "0.965 mm" },
                    { label: "Tab and slot tolerance", inch: ".015\"", mm: "0.381 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "40\"", mm: "1016 mm" },
                    { label: "Min flange length (before bend/Flat Pattern) 90° or less (obtuse)", inch: "0.620\"", mm: "15.748 mm" },
                    { label: "Min flange length (after bend) 90° or less (obtuse)", inch: "0.723\"", mm: "18.364 mm" },
                    { label: "Minimum Length Center of bend line 91-130* (Acute)", inch: "0.806\"", mm: "20.472 mm" },
                    { label: "Die width", inch: "0.984\"", mm: "24.994 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.090\"", mm: "2.286 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (bend length up to 24″)", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (bend length over 24″)", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.205\"", mm: "5.207 mm" },
                    { label: "K Factor", inch: "0.43", mm: "0.43" },
                    { label: "Bend relief depth", inch: "0.235\"", mm: "5.969 mm" },
                    { label: "Minimum joggle. Bend line to bend line @90° max flange", inch: "0.758\"", mm: "19.253 mm" },
                    { label: "Maximum joggle. Bend line to bend line @90° max flange", inch: "3.750\"", mm: "95.25 mm" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5″ x 1.5″", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4″ x 7″", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".190\"": {
                availableServices: ["Laser Cutting", "Bending", "Plating", "Powder Coating", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.190\"", mm: "4.83 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.009\"", mm: "0.229 mm" },
                    { label: "Thickness tolerance negative", inch: "0.009\"", mm: "0.229 mm" },
                    { label: "Mill Finish", inch: "Hot Rolled Finished in Oil", mm: "Hot Rolled Finished in Oil" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".500″ x .750″", mm: "12.7 mm x 19.05 mm" },
                    { label: "Max part size", inch: "44″ x 30″", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".070″", mm: "1.778 mm" },
                    { label: "Min bridge size", inch: ".070″", mm: "1.778 mm" },
                    { label: "Min hole to edge distance", inch: ".057″", mm: "1.448 mm" },
                    { label: "Tab and slot tolerance", inch: ".015\"", mm: "0.381 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "36\"", mm: "914.4 mm" },
                    { label: "Min flange length (before bend/Flat Pattern) 90° or less (obtuse)", inch: "0.620\"", mm: "15.748 mm" },
                    { label: "Min flange length (after bend) 90° or less (obtuse)", inch: "0.782\"", mm: "19.863 mm" },
                    { label: "Minimum Length Center of bend line 91-130* (Acute)", inch: "N/A", mm: "N/A" },
                    { label: "Die width", inch: "0.984\"", mm: "24.994 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.125\"", mm: "3.175 mm" },
                    { label: "Max bend angle", inch: "90°", mm: "90°" },
                    { label: "Bend angle tolerance (bend length up to 24″)", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (bend length over 24″)", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.324\"", mm: "8.230 mm" },
                    { label: "K Factor", inch: "0.37", mm: "0.37" },
                    { label: "Bend relief depth", inch: "0.335\"", mm: "8.509 mm" },
                    { label: "Minimum joggle. Bend line to bend line @90° max flange", inch: "0.829\"", mm: "21.057 mm" },
                    { label: "Maximum joggle. Bend line to bend line @90° max flange", inch: "3.750\"", mm: "95.25 mm" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1″ x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23″ x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5″ x 1.5″", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4″ x 7″", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".250\"": {
                availableServices: ["Laser Cutting", "Bending", "Plating", "Powder Coating", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.250\"", mm: "6.35 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.030\"", mm: "0.762 mm" },
                    { label: "Thickness tolerance negative", inch: "0.010\"", mm: "0.254 mm" },
                    { label: "Mill Finish", inch: "Hot Rolled Finished in Oil", mm: "Hot Rolled Finished in Oil" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".500″ x .750″", mm: "12.7 mm x 19.05 mm" },
                    { label: "Max part size", inch: "44″ x 30″", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".100″", mm: "2.54 mm" },
                    { label: "Min bridge size", inch: ".125″", mm: "3.175 mm" },
                    { label: "Min hole to edge distance", inch: ".075″", mm: "1.905 mm" },
                    { label: "Tab and slot tolerance", inch: ".035\"", mm: "0.889 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "32\"", mm: "812.8 mm" },
                    { label: "Min flange length (before bend/Flat Pattern) 90° or less (obtuse)", inch: "1.150\"", mm: "29.21 mm" },
                    { label: "Min flange length (after bend) 90° or less (obtuse)", inch: "1.367\"", mm: "34.722 mm" },
                    { label: "Minimum Length Center of bend line 91-130* (Acute)", inch: "N/A", mm: "N/A" },
                    { label: "Die width", inch: "1.575\"", mm: "40.005 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.170\"", mm: "4.318 mm" },
                    { label: "Max bend angle", inch: "90°", mm: "90°" },
                    { label: "Bend angle tolerance (bend length up to 24″)", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (bend length over 24″)", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.434\"", mm: "11.024 mm" },
                    { label: "K Factor", inch: "0.36", mm: "0.36" },
                    { label: "Bend relief depth", inch: "0.440\"", mm: "11.176 mm" },
                    { label: "Minimum joggle. Bend line to bend line @90° max flange", inch: "1.425\"", mm: "36.195 mm" },
                    { label: "Maximum joggle. Bend line to bend line @90° max flange", inch: "3.750\"", mm: "95.25 mm" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1″ x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23″ x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5″ x 1.5″", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4″ x 7″", mm: "101.6 mm x 177.8 mm" }
                ]
            }
        },
        aboutSection: {
            title: "What is 4130 Chromoly?",
            text: "4130 Chromoly steel is a durable metal meant for long-lasting projects. If what you're making needs to withstand extreme pressures and temperatures over time, Chromoly might be the metal for you. The reason for this is in one of its key properties: Creep Strength.",
            image: about4130,
            featureChart: [
                { label: "Strength", rating: 4 },
                { label: "Corrosion Resistance", rating: 3 },
                { label: "Weldability", rating: 4 },
                { label: "Toughness", rating: 4 },
                { label: "Formability", rating: 3 },
                { label: "Machinability", rating: 3 },
                { label: "Heat Treating", rating: 5 },
                { label: "Strength-to-Weight Ratio", rating: 5 }
            ],
            capabilities: {
                title: "What can you make with 4130 Chromoly parts?",
                text: "When you use this material in high-stress applications, you can be sure that it will stay in place and hold its shape for longer. Hence why it's often used in bicycle frames, roll cages, and airplane structures all over the world. If you're looking at something a little smaller, like a gear or cog, 4130 Chromoly steel's excellent heat treatability and machinability make it an ideal fit for strong, tiny parts.",
                items: [
                    "Engine mounts",
                    "Fabrication projects",
                    "Shafts",
                    "Aerospace structural",
                    "Bicycle parts",
                    "Resistance welding projects",
                    "Gears",
                    "Structural components",
                    "And so much more!"
                ]
            }
        },
        faqs: [
            {
                question: "What thicknesses does DMS Engineering offer 4130 Chromoly in?",
                answer: "This material comes in five available thicknesses: .050\"(1.27mm), .063\"(1.60mm), .125\"(3.18mm), .190\"(4.83mm), and .250\"(6.35mm)."
            },
            {
                question: "What are the minimum and maximum sizes for cutting 4130 Chromoly?",
                answer: "DMS Engineering offers 4130 Chromoly with clearly defined size and thickness options. Instant quoting is available for parts measuring between .25\" x .375\" and 30\" x 44\", while custom quotes can accommodate larger dimensions up to 30\" x 56\"."
            },
            {
                question: "What additional services are available for 4130 Chromoly?",
                answer: "You can add the following services to your 4130 Chromoly parts: Bending, Plating, Powder Coating, and Tumbling"
            }
        ]
    },
    {
        id: 10,
        name: "COPPER",
        thickness: "5 thicknesses: .040\" - .250\"",
        image: metal10,
        description: "Superior electrical and thermal conductivity. Highly corrosion resistant.",
        services: [3, 9, 10, 7, 12],
        quickLook: {
            cutSizes: [
                { label: "A", size: ".25\" x .375\" min", action: "Instant Pricing", type: "solid" },
                { label: "B", size: "30\" x 44\" max", action: "Instant Pricing", type: "solid" },
                { label: "C", size: "30\" x 44\" max", action: "Custom Quote", type: "outline" }
            ],
            thicknesses: [
                { value: ".040\"", metric: "1.02mm" },
                { value: ".063\"", metric: "1.60mm" },
                { value: ".125\"", metric: "3.18mm" },
                { value: ".187\"", metric: "4.75mm" },
                { value: ".250\"", metric: "6.35mm" }
            ],
            tolerance: "+/- .005\"",
        },
        specifications: {
            availableServices: ["Laser Cutting", "Bending", "Deburring", "Plating", "Tapping", "Tumbling"],
            generalDetails: [
                { label: "Material Type", inch: "Copper (C110)", mm: "Copper (C110)" },
                { label: "ASTM Specification", inch: "ASTM B-152", mm: "ASTM B-152" },
                { label: "Surface Finish", inch: "Smooth Mill", mm: "Smooth Mill" }
            ],
            laserCuttingSpecs: [
                { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                { label: "Max part size", inch: "30\" x 44\"", mm: "762 mm x 1117.6 mm" }
            ],
            properties: [
                { label: "Material Composition", value: "Copper (Cu): 99.9 – 100 Residuals: 0 – 0.1" },
                { label: "Density", value: "560 lb/ft^3" },
                { label: "Heat treatments process", value: "H00-H01 half hard" },
                { label: "Tensile Strength (Ultimate)", value: "43 ksi" },
                { label: "Tensile Strength (Yield)", value: "40 ksi" },
                { label: "Shear Strength", value: "12 ksi" },
                { label: "Shear Modulus", value: "17 ksi" },
                { label: "Fatigue Strength", value: "7-10 ksi" },
                { label: "Brinell Hardness", value: "35" },
                { label: "Elongation at Break", value: "13%" },
                { label: "Elastic Modulus", value: "16-18 ksi" },
                { label: "Poisson’s Ratio", value: ".33" },
                { label: "Thermal Conductivity", value: "223 BTU/h-ft °F" },
                { label: "Melting Point", value: "1984 °F" },
                { label: "Magnetic", value: "No" },
                { label: "Does it Rust", value: "No" }
            ]
        },
        thicknessSpecs: {
            ".040\"": {
                availableServices: ["Laser Cutting", "Bending"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.040\"", mm: "1.02 mm" },
                    { label: "Gauge", inch: "18", mm: "1.02 mm" },
                    { label: "Thickness tolerance positive", inch: "0.008\"", mm: "0.203 mm" },
                    { label: "Thickness tolerance negative", inch: "0.002\"", mm: "0.051 mm" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25″ x .375″", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44″ x 30″", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".016″", mm: "0.406 mm" },
                    { label: "Min bridge size", inch: ".020″", mm: "0.508 mm" },
                    { label: "Min hole to edge distance", inch: ".020″", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before bend/Flat Pattern) 90° or less (obtuse)", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after bend) 90° or less (obtuse)", inch: "0.296\"", mm: "7.518 mm" },
                    { label: "Minimum Length Center of bend line 91-130* (Acute)", inch: "0.332\"", mm: "8.433 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.052\"", mm: "1.321 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (bend length up to 24″)", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (bend length over 24″)", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.081\"", mm: "2.057 mm" },
                    { label: "K Factor", inch: "0.34", mm: "0.34" },
                    { label: "Bend relief depth", inch: "0.112\"", mm: "2.845 mm" },
                    { label: "Minimum joggle. Bend line to bend line @90° max flange", inch: "0.299\"", mm: "7.595 mm" },
                    { label: "Maximum joggle. Bend line to bend line @90° max flange", inch: "3.750\"", mm: "95.25 mm" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1″ x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23″ x 23\"", mm: "584.2 mm x 584.2 mm" }
                ]
            },
            ".063\"": {
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.063\"", mm: "1.60 mm" },
                    { label: "Gauge", inch: "16", mm: "1.60 mm" },
                    { label: "Thickness tolerance positive", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Thickness tolerance negative", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25″ x .375″", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44″ x 30″", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".025″", mm: "0.635 mm" },
                    { label: "Min bridge size", inch: ".032″", mm: "0.813 mm" },
                    { label: "Min hole to edge distance", inch: ".020″", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before bend/Flat Pattern) 90° or less (obtuse)", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after bend) 90° or less (obtuse)", inch: "0.305\"", mm: "7.747 mm" },
                    { label: "Minimum Length Center of bend line 91-130* (Acute)", inch: "0.332\"", mm: "8.433 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.024\"", mm: "0.610 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (bend length up to 24″)", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (bend length over 24″)", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.099\"", mm: "2.515 mm" },
                    { label: "K Factor", inch: "0.36", mm: "0.36" },
                    { label: "Bend relief depth", inch: "0.107\"", mm: "2.718 mm" },
                    { label: "Minimum joggle. Bend line to bend line @90° max flange", inch: "0.324\"", mm: "8.230 mm" },
                    { label: "Maximum joggle. Bend line to bend line @90° max flange", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24″ x 46″", mm: "609.6 mm x 1168.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M6 x 1.0", mm: "M6 x 1.0" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.020\"", mm: "0.508 mm" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1″ x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23″ x 23\"", mm: "584.2 mm x 584.2 mm" }
                ]
            },
            ".125\"": {
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.125\"", mm: "3.18 mm" },
                    { label: "Gauge", inch: "11", mm: "3.18 mm" },
                    { label: "Thickness tolerance positive", inch: "0.008\"", mm: "0.203 mm" },
                    { label: "Thickness tolerance negative", inch: "0.008\"", mm: "0.203 mm" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25″ x .375″", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44″ x 30″", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".040″", mm: "1.02 mm" },
                    { label: "Min bridge size", inch: ".037″", mm: "0.940 mm" },
                    { label: "Min hole to edge distance", inch: ".038″", mm: "0.965 mm" },
                    { label: "Tab and slot tolerance", inch: ".015\"", mm: "0.381 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before bend/Flat Pattern) 90° or less (obtuse)", inch: "0.368\"", mm: "9.347 mm" },
                    { label: "Min flange length (after bend) 90° or less (obtuse)", inch: "0.471\"", mm: "11.963 mm" },
                    { label: "Minimum Length Center of bend line 91-130* (Acute)", inch: "0.478\"", mm: "12.141 mm" },
                    { label: "Die width", inch: "0.630\"", mm: "16.002 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.050\"", mm: "1.27 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (bend length up to 24″)", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (bend length over 24″)", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.205\"", mm: "5.207 mm" },
                    { label: "K Factor", inch: "0.34", mm: "0.34" },
                    { label: "Bend relief depth", inch: "0.195\"", mm: "4.953 mm" },
                    { label: "Minimum joggle. Bend line to bend line @90° max flange", inch: "0.506\"", mm: "12.852 mm" },
                    { label: "Maximum joggle. Bend line to bend line @90° max flange", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24″ x 46″", mm: "609.6 mm x 1168.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M10 x 1.5", mm: "M10 x 1.5" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.038\"", mm: "0.965 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5″ x 1.5″", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4″ x 7″", mm: "101.6 mm x 177.8 mm" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1″ x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23″ x 23\"", mm: "584.2 mm x 584.2 mm" }
                ]
            },
            ".187\"": {
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Plating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.187\"", mm: "4.75 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.010\"", mm: "0.254 mm" },
                    { label: "Thickness tolerance negative", inch: "0.010\"", mm: "0.254 mm" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25″ x .375″", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44″ x 30″", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".060″", mm: "1.524 mm" },
                    { label: "Min bridge size", inch: ".065″", mm: "1.651 mm" },
                    { label: "Min hole to edge distance", inch: ".056″", mm: "1.422 mm" },
                    { label: "Tab and slot tolerance", inch: ".015\"", mm: "0.381 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before bend/Flat Pattern) 90° or less (obtuse)", inch: "0.620\"", mm: "15.748 mm" },
                    { label: "Min flange length (after bend) 90° or less (obtuse)", inch: "0.780\"", mm: "19.812 mm" },
                    { label: "Minimum Length Center of bend line 91-130* (Acute)", inch: "N/A", mm: "N/A" },
                    { label: "Die width", inch: "0.984\"", mm: "25 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.118\"", mm: "3 mm" },
                    { label: "Max bend angle", inch: "90°", mm: "90°" },
                    { label: "Bend angle tolerance (bend length up to 24″)", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (bend length over 24″)", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.320\"", mm: "8.128 mm" },
                    { label: "K Factor", inch: "0.36", mm: "0.36" },
                    { label: "Bend relief depth", inch: "0.305\"", mm: "7.747 mm" },
                    { label: "Minimum joggle. Bend line to bend line @90° max flange", inch: "0.826\"", mm: "20.980 mm" },
                    { label: "Maximum joggle. Bend line to bend line @90° max flange", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24″ x 46″", mm: "609.6 mm x 1168.4 mm" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1″ x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23″ x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "12.7 mm - 20 TPI" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.056\"", mm: "1.422 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5″ x 1.5″", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4″ x 7″", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".250\"": {
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Plating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.250\"", mm: "6.35 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.012\"", mm: "0.305 mm" },
                    { label: "Thickness tolerance negative", inch: "0.012\"", mm: "0.305 mm" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25″ x .375″", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44″ x 30″", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".089″", mm: "2.261 mm" },
                    { label: "Min bridge size", inch: ".080″", mm: "2.032 mm" },
                    { label: "Min hole to edge distance", inch: ".075″", mm: "1.905 mm" },
                    { label: "Tab and slot tolerance", inch: ".020\"", mm: "0.508 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before bend/Flat Pattern) 90° or less (obtuse)", inch: "1.150\"", mm: "29.21 mm" },
                    { label: "Min flange length (after bend) 90° or less (obtuse)", inch: "1.365\"", mm: "34.671 mm" },
                    { label: "Minimum Length Center of bend line 91-130* (Acute)", inch: "N/A", mm: "N/A" },
                    { label: "Die width", inch: "1.575\"", mm: "40.005 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.140\"", mm: "3.556 mm" },
                    { label: "Max bend angle", inch: "90°", mm: "90°" },
                    { label: "Bend angle tolerance (bend length up to 24″)", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (bend length over 24″)", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.430\"", mm: "10.922 mm" },
                    { label: "K Factor", inch: "0.33", mm: "0.33" },
                    { label: "Bend relief depth", inch: "0.405\"", mm: "10.287 mm" },
                    { label: "Minimum joggle. Bend line to bend line @90° max flange", inch: "1.425\"", mm: "36.195 mm" },
                    { label: "Maximum joggle. Bend line to bend line @90° max flange", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24″ x 46″", mm: "609.6 mm x 1168.4 mm" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1″ x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23″ x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "12.7 mm - 20 TPI" },
                    { label: "Smallest Tap", inch: "4-40", mm: "#4-40 UNC" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.075\"", mm: "1.905 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5″ x 1.5″", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4″ x 7″", mm: "101.6 mm x 177.8 mm" }
                ]
            }
        },
        aboutSection: {
            title: "What is Copper?",
            text: "Our C110 half-hard copper is classified as electrolytic copper, which basically means it's an extremely high purity (greater than 99% copper, ours is 99.9%). For your projects, this means that the material's electrical properties won't be hampered by any erroneous leftover elements. You're getting one of the purest grades available.",
            image: aboutCopper,
            featureChart: [
                { label: "Strength", rating: 2 },
                { label: "Corrosion Resistance", rating: 5 },
                { label: "Weldability", rating: 1 },
                { label: "Toughness", rating: 1 },
                { label: "Formability", rating: 5 },
                { label: "Machinability", rating: 3 },
                { label: "Heat Treating", rating: 1 },
                { label: "Strength-to-Weight Ratio", rating: 1 }
            ],
            capabilities: {
                title: "What can you make with Copper parts?",
                text: "Copper, only surpassed by silver in its electrical properties, is perfect for hospital settings due to its antimicrobial nature. In diagnostic equipment, you'll find this material assisting in transmitting signals for examination and providing the necessary structure in small, vital implants. Send us your design and we'll help you manufacture the highest-quality busbars, heat sinks, connectors and more.",
                items: [
                    "Motor parts",
                    "Industrial machinery",
                    "Electronic components",
                    "Wiring",
                    "Roofing",
                    "Solar kits",
                    "RV conversion kits",
                    "Plumbing",
                    "And so much more!"
                ]
            }
        },
        faqs: [
            {
                id: 1001,
                question: "What thicknesses does DMS Engineering offer Copper in?",
                answer: "Choose from five thicknesses including .040\u0022(1.02mm), .063\u0022(1.60mm), .125\u0022(3.18mm), .187\u0022(4.75mm), and .250\u0022(6.35mm)."
            },
            {
                id: 1002,
                question: "What are the minimum and maximum sizes for cutting Copper?",
                answer: "Copper is available at DMS Engineering with a range of thicknesses and part sizes. Instant quotes are possible for dimensions between .25\u0022 x .375\u0022 and 30\u0022 x 44\u0022."
            },
            {
                id: 1003,
                question: "What additional services are available for Copper?",
                answer: "You can add the following services to your Copper parts: Bending, Deburring, Plating, Tapping, and Tumbling."
            }
        ]
    },
    {
        id: 11,
        name: "CPM MAGNACUT STAINLESS STEEL",
        thickness: "1 thickness: .155\"",
        image: metal11,
        description: "Premium blade steel with a balance of toughness, edge retention, and corrosion resistance.",
        quickLook: {
            cutSizes: [
                { label: "A", size: ".5\" x .5\"min", action: "Instant Pricing", type: "solid" },
                { label: "B", size: "23\" x 23\"max", action: "Instant Pricing", type: "solid" },
                { label: "C", size: "23\" x 34\"max", action: "Custom Quote", type: "outline" }
            ],
            thicknesses: [
                { value: ".155\"", metric: "3.94mm" }
            ],
            tolerance: "Laser cut, +/- .005\" tolerance"
        },
        specifications: {
            availableServices: ["Laser Cutting"],
            generalDetails: [
                { label: "Advertised Thickness", inch: "0.155\"", mm: "3.94mm" },
                { label: "Thickness tolerance positive", inch: "0.007\"", mm: "0.178mm" },
                { label: "Thickness tolerance negative", inch: "0.007\"", mm: "0.178mm" },
                { label: "Mill Finish", inch: "Hot Rolled", mm: "Hot Rolled" },
                { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
            ],
            laserCuttingSpecs: [
                { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127mm" },
                { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/- 2.5mm per meter" },
                { label: "Min part size", inch: ".500″ x .500″", mm: "12.7mm x 12.7mm" },
                { label: "Max part size", inch: "23″ x 23″", mm: "584.2mm x 584.2mm" },
                { label: "Min hole size", inch: ".062″", mm: "1.57mm" },
                { label: "Min bridge size", inch: ".073″", mm: "1.85mm" },
                { label: "Min hole to edge distance", inch: ".062″", mm: "1.57mm" },
                { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254mm" }
            ],
            properties: [
                { label: "Material Composition", value: "Carbon (C): 1.14 – 1.16 Manganese (Mn): 0.35 – 0.45 Phosphorus (P): 0 – 0.05 Sulfur (S): 0 – 0.01 Silicon (Si): 0.10 – 0.25 Chromium (Cr): 10.2 – 10.7 Nickel (Ni): 0 – 0.05 Molybdenum (Mo): 1.80 – 2.00 Vanadium (V): 3.60 – 4.00 Niobium (Nb): 2.00 – 2.20 Nitrogen (N): 0.18 – 0.22 Copper (Cu): 0 – 0.02 Iron (Fe): Balance" },
                { label: "Material Type", value: "CPM Stainless Tool Steel (Powder Metallurgy)" },
                { label: "Finish", value: "Descaled, matte gray surface (hot-rolled)" },
                { label: "Density", value: "489 lb/ft^3" },
                { label: "Heat treatments process", value: "Annealed (can be heat treated to ~60 HRC)" },
                { label: "Tensile Strength (Ultimate)", value: "~285 ksi hardened, ~110 ksi annealed" },
                { label: "Tensile Strength (Yield)", value: "~240 KSI" },
                { label: "Shear Strength", value: "165 ksi" },
                { label: "Shear Modulus", value: "11800 ksi" },
                { label: "Fatigue Strength", value: "50 ksi" },
                { label: "Brinell Hardness (Annealed)", value: "197 HB" },
                { label: "Brinell Hardness (Hardened)", value: "60–64 HRC typical" },
                { label: "Elongation at Break", value: "10-12%" },
                { label: "Elastic Modulus", value: "29000 ksi" },
                { label: "Poisson’s Ratio", value: ".28" },
                { label: "Thermal Conductivity", value: "13 BTU/h-ft °F" },
                { label: "Melting Point", value: "2550 °F" },
                { label: "Magnetic", value: "Yes" },
                { label: "Does it Rust", value: "No" }
            ]
        },
        aboutSection: {
            title: "What is CPM MagnaCut?",
            text: "CPM MagnaCut is a modern stainless tool steel designed to deliver high toughness, strong wear resistance, and excellent corrosion resistance all at once, something most steels can't do. Instead of forming large chromium carbides, MagnaCut uses a fine mix of vanadium and niobium carbides while keeping chromium in solution, which significantly boosts rust resistance and edge durability. Thanks to its powder-metallurgy construction and a precise heat-treat process, it can reliably reach 60–63 HRC while staying impressively tough. The result is a stainless steel that performs like a high-end carbon tool steel but with far better resistance to moisture, staining, and harsh environments.",
            image: aboutMagnaCut,
            featureChart: [
                { label: "Strength", rating: 5 },
                { label: "Corrosion Resistance", rating: 5 },
                { label: "Weldability", rating: 2 },
                { label: "Toughness", rating: 5 },
                { label: "Formability", rating: 3 },
                { label: "Machinability", rating: 3 },
                { label: "Heat Treating", rating: 5 },
                { label: "Strength-to-Weight Ratio", rating: 5 }
            ],
            capabilities: {
                title: "What can you make with CPM MagnaCut parts?",
                text: "CPM MagnaCut is ideal for high-performance parts and tools that need outstanding toughness, edge retention, and corrosion resistance. Here are a few of the most common projects that use CPM MagnaCut.",
                items: [
                    "Knives and precision cutting blades",
                    "Outdoor and EDC tool components",
                    "Machine fixtures and shop tooling plates",
                    "Scrapers, chisels, and shaping blades",
                    "Brackets, hinges, and small hardware",
                    "High-strength mechanical linkages",
                    "Jigs, guides, and cutting templates",
                    "High-wear industrial parts",
                    "And so much more!"
                ]
            }
        },
        faqs: [
            {
                question: "What thicknesses does DMS Engineering offer CPM MagnaCut in?",
                answer: "DMS Engineering offers CPM MagnaCut Stainless Steel in 0.155\" thickness."
            },
            {
                question: "What are the minimum and maximum sizes for cutting CPM MagnaCut?",
                answer: "At DMS Engineering, there are specific size and thickness parameters to keep in mind for CPM MagnaCut. For instant quoting, the smallest part size available is 23\"x23\", while the largest part supported via a custom quote is 23\"x34\"."
            },
            {
                question: "What additional services are available for CPM MagnaCut?",
                answer: "No secondary services are currently available on DMS Engineering's laser cut CPM MagnaCut Steel."
            }
        ]
    },
    {
        id: 12,
        name: "G90 STEEL",
        thickness: "5 thicknesses: .030\" - .074\"",
        image: metal12,
        description: "Galvanized steel with a heavy zinc coating for long-term corrosion resistance.",
        quickLook: {
            cutSizes: [
                { label: "A", size: ".25\" x .375\" min", action: "Instant Pricing", type: "solid" },
                { label: "B", size: "30\" x 44\" max", action: "Instant Pricing", type: "solid" },
                { label: "C", size: "30\" x 56\" max", action: "Custom Quote", type: "outline" }
            ],
            thicknesses: [
                { value: ".030\"", metric: ".76mm" },
                { value: ".036\"", metric: ".91mm" },
                { value: ".048\"", metric: "1.22mm" },
                { value: ".059\"", metric: "1.50mm" },
                { value: ".074\"", metric: "1.88mm" }
            ],
            tolerance: "+/- .005\""
        },
        specifications: {
            properties: [
                { label: "Material Composition", value: "Carbon/0.03, Manganese/0.17, Phosphorus/0.011, Sulfur/0.002, Silicon/0.03, Copper/0.12, Tin/0.006, Nickel/0.04, Chromium/0.05, Molybdenum/0.01, Aluminum/0.043, Nitrogen/0.0063, Vanadium/<0.001, Niobium/<0.001, Titanium/0.001, Boron/<0.0001, Calcium/0.0016" },
                { label: "Density", value: "490 lb/ft^3" },
                { label: "Heat treatments process", value: "N/A" },
                { label: "ASTM", value: "ASTM A653 G90" },
                { label: "Tensile Strength (Ultimate)", value: "58-65 ksi" },
                { label: "Tensile Strength (Yield)", value: "46 ksi" },
                { label: "Shear Strength", value: "34 ksi" },
                { label: "Shear Modulus", value: "11000 ksi" },
                { label: "Fatigue Strength", value: "32 ksi" },
                { label: "Brinell Hardness", value: "120-180" },
                { label: "Elongation at Break", value: "20%" },
                { label: "Elastic Modulus", value: "29000 ksi" },
                { label: "Poisson’s Ratio", value: ".30" },
                { label: "Thermal Conductivity", value: "36 BTU/h-ft °F" },
                { label: "Melting Point", value: "2500-2800°F" },
                { label: "Magnetic", value: "Yes" },
                { label: "Does it Rust", value: "Yes" }
            ]
        },
        thicknessSpecs: {
            ".030\"": {
                showcaseImages: [g90_030_showcase],
                availableServices: ["Laser Cutting", "Bending", "Dimple Forming"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.030\"", mm: "0.762 mm" },
                    { label: "Gauge", inch: "22", mm: "22" },
                    { label: "Thickness tolerance positive", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Thickness tolerance negative", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Mill finish", inch: "Cold rolled, hot dipped galvanized", mm: "Cold rolled, hot dipped galvanized" },
                    { label: "Top/Bottom Finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Min hole size", inch: "0.015\"", mm: "0.381 mm" },
                    { label: "Min bridge size", inch: "0.015\"", mm: "0.381 mm" },
                    { label: "Min hole to edge distance", inch: "0.020\"", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: "0.010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min Bend Part Size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max Bending Flat Part Size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max Bend Length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min Flange Length (Before Bend) 90° or less", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min Flange Length (After Bend) 90° or less", inch: "0.286\"", mm: "7.264 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "0.344\"", mm: "8.738 mm" },
                    { label: "Die Width", inch: "0.472\"", mm: "11.176 mm" },
                    { label: "Effective Bend Radius @ 90°", inch: "0.045\"", mm: "1.143 mm" },
                    { label: "Max Bend Angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24″)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24″)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend Deduction @ 90°", inch: "0.061\"", mm: "1.549 mm" },
                    { label: "K Factor", inch: "0.38", mm: "0.38" },
                    { label: "Bend Relief Depth", inch: "0.095\"", mm: "2.413 mm" },
                    { label: "Minimum Joggle", inch: "0.344\"", mm: "8.738 mm" },
                    { label: "Maximum Joggle", inch: "3.750\"", mm: "95.25 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.200\" x 5.200\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: ".500\"", mm: "12.7 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (.500\" dimple)", inch: ".125\"", mm: "3.175 mm" },
                    { label: "Dimple overall height (.750\" dimple)", inch: ".127\"", mm: "3.226 mm" },
                    { label: "Dimple overall height (1.000\" dimple)", inch: ".170\"", mm: "4.318 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".183\"", mm: "4.648 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".200\"", mm: "5.08 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".208\"", mm: "5.283 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".225\"", mm: "5.715 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".285\"", mm: "7.239 mm" },
                    { label: "Dimple overall height (3.000\" dimple)", inch: "0.365\"", mm: "9.271 mm" }
                ]
            },
            ".036\"": {
                showcaseImages: [g90_036_showcase],
                availableServices: ["Laser Cutting", "Bending", "Dimple Forming"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.036\"", mm: "0.914 mm" },
                    { label: "Gauge", inch: "20", mm: "20" },
                    { label: "Thickness tolerance positive", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Thickness tolerance negative", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Mill finish", inch: "Cold rolled, hot dipped galvanized", mm: "Cold rolled, hot dipped galvanized" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Min hole size", inch: "0.018\"", mm: "0.457 mm" },
                    { label: "Min bridge size", inch: "0.020\"", mm: "0.508 mm" },
                    { label: "Min hole to edge distance", inch: "0.020\"", mm: "0.508 mm" }
                ],
                bendingSpecs: [
                    { label: "Min Bend Part Size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max Bending Flat Part Size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max Bend Length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min Flange Length (Before Bend) 90° or less", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min Flange Length (After Bend) 90° or less", inch: "0.298\"", mm: "7.569 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "0.344\"", mm: "8.738 mm" },
                    { label: "Die Width", inch: "0.472\"", mm: "11.176 mm" },
                    { label: "Effective Bend Radius @ 90°", inch: "0.045\"", mm: "1.143 mm" },
                    { label: "Max Bend Angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24″)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24″)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend Deduction @ 90°", inch: "0.073\"", mm: "1.854 mm" },
                    { label: "K Factor", inch: "0.38", mm: "0.38" },
                    { label: "Bend Relief Depth", inch: "0.101\"", mm: "2.565 mm" },
                    { label: "Minimum Joggle", inch: "0.344\"", mm: "8.738 mm" },
                    { label: "Maximum Joggle", inch: "3.750\"", mm: "95.25 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.200\" x 5.200\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: ".500\"", mm: "12.7 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (.500\" dimple)", inch: ".140\"", mm: "3.556 mm" },
                    { label: "Dimple overall height (.750\" dimple)", inch: ".150\"", mm: "3.81 mm" },
                    { label: "Dimple overall height (1.000\" dimple)", inch: ".190\"", mm: "4.826 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".200\"", mm: "5.08 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".220\"", mm: "5.588 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".235\"", mm: "5.969 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".250\"", mm: "6.35 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".270\"", mm: "6.858 mm" },
                    { label: "Dimple overall height (3.000\" dimple)", inch: ".385\"", mm: "9.779 mm" }
                ]
            },
            ".048\"": {
                showcaseImages: [g90_048_showcase],
                availableServices: ["Laser Cutting", "Bending", "Dimple Forming", "Hardware"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.048\"", mm: "1.219 mm" },
                    { label: "Gauge", inch: "18", mm: "18" },
                    { label: "Thickness tolerance positive", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Thickness tolerance negative", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Mill Finish", inch: "Cold rolled, hot dipped galvanized", mm: "Cold rolled, hot dipped galvanized" },
                    { label: "Top/Bottom Finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Min hole size", inch: "0.020\"", mm: "0.508 mm" },
                    { label: "Min bridge size", inch: "0.024\"", mm: "0.61 mm" },
                    { label: "Min hole to edge distance", inch: "0.020\"", mm: "0.508 mm" }
                ],
                bendingSpecs: [
                    { label: "Min Bend Part Size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max Bending Flat Part Size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max Bend Length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min Flange Length (Before Bend) 90° or less", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min Flange Length (After Bend) 90° or less", inch: "0.298\"", mm: "7.569 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "0.344\"", mm: "8.738 mm" },
                    { label: "Die Width", inch: "0.472\"", mm: "11.176 mm" },
                    { label: "Effective Bend Radius @ 90°", inch: "0.045\"", mm: "1.143 mm" },
                    { label: "Max Bend Angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24″)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24″)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend Deduction @ 90°", inch: "0.086\"", mm: "2.184 mm" },
                    { label: "K Factor", inch: "0.38", mm: "0.38" },
                    { label: "Bend Relief Depth", inch: "0.113\"", mm: "2.87 mm" },
                    { label: "Minimum Joggle", inch: "0.308\"", mm: "7.823 mm" },
                    { label: "Maximum Joggle", inch: "3.750\"", mm: "95.25 mm" }
                ],
                hardwareSpecs: [
                    { label: "Hardware Min Part Size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Hardware Max Part Size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height (hardware)", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "Please view our Hardware Catalog", mm: "Please view our Hardware Catalog" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.200\" x 5.200\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: ".500\"", mm: "12.7 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (.500\" dimple)", inch: ".140\"", mm: "3.556 mm" },
                    { label: "Dimple overall height (.750\" dimple)", inch: ".150\"", mm: "3.81 mm" },
                    { label: "Dimple overall height (1.000\" dimple)", inch: ".190\"", mm: "4.826 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".200\"", mm: "5.08 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".220\"", mm: "5.588 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".235\"", mm: "5.969 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".250\"", mm: "6.35 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".270\"", mm: "6.858 mm" },
                    { label: "Dimple overall height (3.000\" dimple)", inch: ".385\"", mm: "9.779 mm" }
                ]
            },
            ".059\"": {
                showcaseImages: [g90_059_showcase],
                availableServices: ["Laser Cutting", "Bending", "Dimple Forming", "Hardware", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.059\"", mm: "1.499 mm" },
                    { label: "Gauge", inch: "16", mm: "16" },
                    { label: "Thickness tolerance positive", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Thickness tolerance negative", inch: "0.004\"", mm: "0.102 mm" },
                    { label: "Mill finish", inch: "Cold rolled, hot dipped galvanized", mm: "Cold rolled, hot dipped galvanized" },
                    { label: "Top/Bottom Finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Min hole size", inch: "0.022\"", mm: "0.559 mm" },
                    { label: "Min bridge size", inch: "0.030\"", mm: "0.762 mm" },
                    { label: "Min hole to edge distance", inch: "0.020\"", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: "0.010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min Bend Part Size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max Bending Flat Part Size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max Bend Length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min Flange Length (Before Bend) 90° or less", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min Flange Length (After Bend) 90° or less", inch: "0.311\"", mm: "7.899 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "0.344\"", mm: "8.738 mm" },
                    { label: "Die Width", inch: "0.472\"", mm: "11.176 mm" },
                    { label: "Effective Bend Radius @ 90°", inch: "0.063\"", mm: "1.6 mm" },
                    { label: "Max Bend Angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24″)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24″)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend Deduction @ 90°", inch: "0.112\"", mm: "2.845 mm" },
                    { label: "K Factor", inch: "0.36", mm: "0.36" },
                    { label: "Bend Relief Depth", inch: "0.142\"", mm: "3.607 mm" },
                    { label: "Minimum Joggle", inch: "0.320\"", mm: "8.128 mm" },
                    { label: "Maximum Joggle", inch: "3.750\"", mm: "95.25 mm" }
                ],
                hardwareSpecs: [
                    { label: "Hardware Min Part Size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Hardware Max Part Size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height (hardware)", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "Please view our Hardware Catalog", mm: "Please view our Hardware Catalog" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M3 x 0.5", mm: "M3 x 0.5" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.020\"", mm: "0.508 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.020\"", mm: "Tap hole size/2 +0.508 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.200\" x 5.200\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: ".500\"", mm: "12.7 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (.500\" dimple)", inch: ".151\"", mm: "3.835 mm" },
                    { label: "Dimple overall height (.750\" dimple)", inch: ".155\"", mm: "3.937 mm" },
                    { label: "Dimple overall height (1.000\" dimple)", inch: ".200\"", mm: "5.08 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".215\"", mm: "5.461 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".230\"", mm: "5.842 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".248\"", mm: "6.299 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".260\"", mm: "6.604 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".315\"", mm: "8.001 mm" },
                    { label: "Dimple overall height (3.000\" dimple)", inch: ".400\"", mm: "10.16 mm" }
                ]
            },
            ".074\"": {
                showcaseImages: [g90_074_showcase],
                availableServices: ["Laser Cutting", "Bending", "Dimple Forming", "Hardware", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.074\"", mm: "1.88 mm" },
                    { label: "Gauge", inch: "14", mm: "14" },
                    { label: "Thickness tolerance positive", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Thickness tolerance negative", inch: "0.004\"", mm: "0.102 mm" },
                    { label: "Mill finish", inch: "Cold rolled, hot dipped galvanized", mm: "Cold rolled, hot dipped galvanized" },
                    { label: "Top/Bottom Finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Min hole size", inch: "0.028\"", mm: "0.711 mm" },
                    { label: "Min bridge size", inch: "0.032\"", mm: "0.813 mm" },
                    { label: "Min hole to edge distance", inch: "0.022\"", mm: "0.559 mm" },
                    { label: "Tab and slot tolerance", inch: "0.010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min Bend Part Size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max Bending Flat Part Size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max Bend Length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min Flange Length (Before Bend) 90° or less", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min Flange Length (After Bend) 90° or less", inch: "0.320\"", mm: "8.128 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "0.344\"", mm: "8.738 mm" },
                    { label: "Die Width", inch: "0.472\"", mm: "11.176 mm" },
                    { label: "Effective Bend Radius @ 90°", inch: "0.063\"", mm: "1.6 mm" },
                    { label: "Max Bend Angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24″)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24″)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend Deduction @ 90°", inch: "0.129\"", mm: "3.277 mm" },
                    { label: "K Factor", inch: "0.4", mm: "0.4" },
                    { label: "Bend Relief Depth", inch: "0.157\"", mm: "3.988 mm" },
                    { label: "Minimum Joggle", inch: "0.336\"", mm: "8.534 mm" },
                    { label: "Maximum Joggle", inch: "3.750\"", mm: "95.25 mm" }
                ],
                hardwareSpecs: [
                    { label: "Hardware Min Part Size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Hardware Max Part Size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height (hardware)", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "Please view our Hardware Catalog", mm: "Please view our Hardware Catalog" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M6 x 1.0", mm: "M6 x 1.0" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.022\"", mm: "0.559 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.022\"", mm: "Tap hole size/2 +0.559 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.200\" x 5.200\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: ".500\"", mm: "12.7 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (1.000\" dimple)", inch: ".205\"", mm: "5.207 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".230\"", mm: "5.842 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".250\"", mm: "6.35 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".266\"", mm: "6.756 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".285\"", mm: "7.239 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".345\"", mm: "8.763 mm" },
                    { label: "Dimple overall height (3.000\" dimple)", inch: ".415\"", mm: "10.541 mm" }
                ]
            }
        },
        aboutSection: {
            title: "What is G90 Galvanized Steel?",
            text: "G90 steel, a hot-dip galvanized steel with a coating weight of 90 grams per square meter, offers a myriad of benefits in various industrial applications. Ideal for outdoor applications like construction and automotive components, it combines durability with visual appeal. Its formability and weldability streamline manufacturing processes, while the zinc coating enhances overall strength. The longevity of G90 steel not only ensures durability but also contributes to sustainability by reducing the need for frequent replacements, making it a preferred material for diverse industrial uses.",
            image: aboutG90,
            featureChart: [
                { label: "Strength", rating: 3 },
                { label: "Corrosion Resistance", rating: 4 },
                { label: "Weldability", rating: 3 },
                { label: "Toughness", rating: 3 },
                { label: "Formability", rating: 4 },
                { label: "Machinability", rating: 2 },
                { label: "Heat Treating", rating: 1 },
                { label: "Strength-to-Weight Ratio", rating: 3 }
            ],
            capabilities: {
                title: "What can you make with G90 Galvanized Steel parts?",
                text: "G90 steel is a go-to choice for various applications spanning different industries. Since it doesn't rust easily, it's an ideal material for outdoor and marine environments. Easy to shape and weld, consider G90 for your next laser cut project. And if you need extra touches, we offer services like bending, putting in hardware, and tapping.",
                items: ["Roofing", "Siding", "Chassis components", "Automotive body panels", "Agricultural equipment", "Highway guardrails", "Structural components", "Marine applications", "And so much more!"]
            }
        },
        services: [3, 5, 6, 7],
        faqs: [
            {
                question: "What thicknesses does DMS Engineering offer G90 Galvanized Steel in?",
                answer: "This material is available in five thickness options: .030\" (0.76mm), .036\" (0.91mm), .048\" (1.22mm), .059\" (1.50mm) and .074\" (1.88mm)."
            },
            {
                question: "What are the minimum and maximum sizes for cutting G90 Galvanized Steel?",
                answer: "DMS Engineering cuts G90 Galvanized Steel in a broad range of sizes and thicknesses. Instant quoting is available for parts as small as .25\" x .375\" and as large as 30\" x 44\". Larger parts, up to 30\" x 56\", can be ordered through a custom quote."
            },
            {
                question: "What additional services are available for G90 Galvanized Steel?",
                answer: "You can add the following services to your G90 Galvanized Steel parts: Bending, Dimple Forming, Hardware Insertion, and Tapping"
            }
        ]
    },
    {
        id: 13, name: "1095 HIGH CARBON STEEL", thickness: "2 thicknesses: .125\" & .187\"", image: metal13, description: "Popular steel for knives and cutting tools due to its excellent edge retention.", quickLook: {
            cutSizes: [
                { label: "A", size: ".5\" x .5\" min", action: "Instant Pricing", type: "solid" },
                { label: "B", size: "24\" x 44\" max", action: "Instant Pricing", type: "solid" },
                { label: "C", size: "24\" x 56\" max", action: "Custom Quote", type: "outline" }
            ],
            thicknesses: [
                { value: ".125\"", metric: "3.18mm" },
                { value: ".187\"", metric: "4.75mm" }
            ],
            tolerance: "+/- .005\""
        }, specifications: {
            availableServices: ["Laser Cutting"],
            generalDetails: [],
            laserCuttingSpecs: [],
            properties: [
                { label: "Material Composition", value: "Carbon (C): 0.90 – 1.03 Manganese (Mn): 0.30 – 0.50 Phosphorus (P): 0 – 0.04 Sulfur (S): 0 – 0.05 Silicon (Si): 0.15 – 0.35 Chromium (Cr): 0 – 0.15 Nickel (Ni): 0 – 0.10 Copper (Cu): 0 – 0.20 Molybdenum (Mo): 0 – 0.01 Tin (Sn): 0 – 0.01 Titanium (Ti): 0 – 0.01 Vanadium (V): 0 – 0.01 Iron (Fe): Balance" },
                { label: "Density", value: "490.752 lb/ft^3" },
                { label: "Heat treatments process", value: "Annealed (can be heat treated to ~60 HRC)" },
                { label: "ASTM", value: "A684" },
                { label: "Tensile Strength (Ultimate)", value: "100 ksi" },
                { label: "Tensile Strength (Yield)", value: "75 ksi" },
                { label: "Shear Strength", value: "60 ksi" },
                { label: "Shear Modulus", value: "11500 ksi" },
                { label: "Fatigue Strength", value: "50 ksi" },
                { label: "Brinell Hardness", value: "197 HB (annealed)" },
                { label: "Elongation at Break", value: "10%" },
                { label: "Elastic Modulus", value: "29000 ksi" },
                { label: "Poisson’s Ratio", value: ".29" },
                { label: "Thermal Conductivity", value: "26 BTU/h-ft °F" },
                { label: "Melting Point", value: "2600 °F" },
                { label: "Magnetic", value: "Yes" },
                { label: "Does it Rust", value: "Yes, prone to rust without coating" }
            ]
        },
        thicknessSpecs: {
            ".125\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.125\"", mm: "3.18 mm" },
                    { label: "Thickness tolerance positive", inch: "0.007\"", mm: "0.178 mm" },
                    { label: "Thickness tolerance negative", inch: "0.007\"", mm: "0.178 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".500\" x .500\"", mm: "12.7 mm x 12.7 mm" },
                    { label: "Max part size", inch: "44\" x 24\"", mm: "1117.6 mm x 609.6 mm" },
                    { label: "Min hole size", inch: ".050\"", mm: "1.27 mm" },
                    { label: "Min bridge size", inch: ".063\"", mm: "1.6 mm" },
                    { label: "Min hole to edge distance", inch: ".038\"", mm: "0.965 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ]
            },
            ".187\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.187\"", mm: "4.75 mm" },
                    { label: "Thickness tolerance positive", inch: "0.014\"", mm: "0.356 mm" },
                    { label: "Thickness tolerance negative", inch: "0.014\"", mm: "0.356 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".500\" x .500\"", mm: "12.7 mm x 12.7 mm" },
                    { label: "Max part size", inch: "44\" x 24\"", mm: "1117.6 mm x 609.6 mm" },
                    { label: "Min hole size", inch: ".075\"", mm: "1.905 mm" },
                    { label: "Min bridge size", inch: ".094\"", mm: "2.388 mm" },
                    { label: "Min hole to edge distance", inch: ".056\"", mm: "1.422 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ]
            }
        },
        aboutSection: {
            image: about1095,
            featureChart: [
                { label: "Strength", rating: 5 },
                { label: "Corrosion Resistance", rating: 1 },
                { label: "Weldability", rating: 1 },
                { label: "Toughness", rating: 4 },
                { label: "Formability", rating: 2 },
                { label: "Machinability", rating: 2 },
                { label: "Heat Treating", rating: 5 },
                { label: "Strength-to-Weight Ratio", rating: 4 }
            ],
            title: "What is High Carbon 1095 Steel?",
            text: "1095 is a cold rolled, annealed high carbon spring steel that balances machinability and strength. When heat-treated, it achieves high hardness and excellent wear resistance. Due to 1095's high carbon content, it's not suited for welding or corrosive environments without further treatment.",
            capabilities: {
                title: "What can you make with High Carbon 1095 Steel parts?",
                text: "DMS Engineering's 1095 carbon steel is ideal for parts that need lasting durability through repeated stress and wear.",
                items: ["Knives & cutting tools", "Leaf springs", "Flat springs", "Punch & die components", "Industrial scrapers", "Forming dies", "Tension washers", "Hard-wearing machine parts", "And so much more!"]
            }
        },
        faqs: [
            {
                question: "What thicknesses does DMS Engineering offer High Carbon 1095 Steel in?",
                answer: "DMS Engineering offers 1095 high carbon steel in two thickness options: .125\" (3.18mm), or .187\" (4.75mm)."
            },
            {
                question: "What are the minimum and maximum sizes for cutting High Carbon 1095 Steel?",
                answer: "1095 Cold Rolled Annealed Spring Steel is available at DMS Engineering with a range of thicknesses and part sizes. Instant quotes are possible for dimensions between .5\" x .5\" and 24\" x 44\", while custom quoting extends the maximum size to 24\" x 56\"."
            },
            {
                question: "What additional services are available for High Carbon 1095 Steel?",
                answer: "No additional services are available for High Carbon 1095 Steel at this time."
            }
        ]
    },
    {
        id: 14,
        name: "MILD STEEL",
        thickness: "12 thicknesses: .030\" - .500\"",
        image: metal14,
        description: "General purpose steel with good weldability and machinability.",
        quickLook: { cutSizes: [], thicknesses: [], tolerance: "" },
        services: [3, 5, 6, 7, 10, 11, 12],
        specifications: { availableServices: ["Laser Cutting", "Bending", "Dimple Forming", "Hardware Insertion", "Tapping", "Plating", "Powder Coating", "Tumbling"], generalDetails: [], laserCuttingSpecs: [], properties: [] },
        subMetals: [
            {
                id: 21,
                name: "Cold Rolled (1008)",
                image: aboutMetal1,
                tags: ["Automotive body panels", "Ductwork", "Furniture components", "Shelving units", "Computer chassis", "Control panels", "Brackets", "Electronics casings", "Automotive chassis components"]
            },
            {
                id: 22,
                name: "HRP&O (A36/A1018)",
                image: aboutMetal2,
                tags: ["Automotive structural parts", "Structural beams", "Bracing", "Machine bases", "Couplings", "Crane components", "Brackets", "Automotive chassis components", "Welded assemblies"]
            },
            {
                id: 23,
                name: "Hot Rolled (A36)",
                image: metal3,
                tags: ["Automotive frames", "Automotive structural parts", "Metal enclosures", "Base plates", "Desk supports", "Building frames", "Automotive chassis components", "Equipment frames"]
            }
        ],
        aboutSection: {
            title: "1008, A36, and A36/A1018 steels for your next project",
            text: "With our hot and cold rolled mild steel offerings, it can be challenging to know which best suits your current project. Click on the buttons below to learn more about each mild steel. If you have any more questions that weren't covered here, reach out anytime and our applications engineers will get back to you.",
            comparisonTable: {
                headers: ["Cold Rolled (1008)", "HRP&O (A36/A1018)", "Hot Rolled (A36)"],
                mappedIds: [21, 22, 23],
                rows: [
                    { label: "Strength", ratings: [2, 3, 3] },
                    { label: "Weldability", ratings: [4, 4, 5] },
                    { label: "Corrosion Resistance", ratings: [3, 3, 2] },
                    { label: "Toughness", ratings: [2, 3, 3] },
                    { label: "Formability", ratings: [5, 5, 5] },
                    { label: "Machinability", ratings: [2, 2, 2] },
                    { label: "Heat Treating", ratings: [2, 3, 2] },
                    { label: "Strength-to-Weight Ratio", ratings: [2, 3, 2] },
                    { label: "Available Thicknesses", values: [".030\" – .135\"", ".187\" – .250\"", ".313\" – .500\""] }
                ]
            },
            capabilities: {
                title: "What can you make with mild steel sheet metal?",
                text: "Recognized for its cost-effectiveness, strength, and versatile nature, mild steel plays a pivotal role in a myriad of applications across different industries. Its widespread usage stems from its malleability and weldability, making it a favored material for fabricators and manufacturers. From providing the structural backbone in construction to forming the basis for automotive components, mild steel finds its place in an extensive array of products and structures.",
                items: ["Automotive structural parts", "Structural beams", "Bracing", "Machine bases", "Couplings", "Crane components", "Brackets", "Automotive chassis components", "Welded assemblies"]
            }
        },
        faqs: [
            {
                question: "What is the difference between Hot Rolled and Cold Rolled mild steel?",
                answer: "Hot rolled steel is processed at high temperatures, making it easier to form but with a coarser finish. Cold rolled steel is processed at room temperature, resulting in tighter tolerances, a smoother surface finish, and increased strength."
            },
            {
                question: "Does Mild Steel need a protective coating to prevent rust?",
                answer: "Yes, Mild Steel is susceptible to oxidation and rust when exposed to moisture. We recommend post-processing services like powder coating or plating to provide a durable, corrosion-resistant finish for your parts."
            },
            {
                question: "Is Mild Steel suitable for high-precision laser cutting?",
                answer: "Absolutely. Mild Steel is one of the most common and cost-effective materials for laser cutting. It provides clean edges and can be cut with high precision across a wide range of thicknesses, from thin sheets to heavy plates."
            }
        ]
    },
    {
        id: 21,
        name: "COLD ROLLED (1008)",
        thickness: "Thicknesses: .030\" – .135\"",
        image: aboutMetal1,
        description: "Low carbon steel with a smooth surface finish and tight tolerances.",
        quickLook: {
            cutSizes: [
                { label: "A", size: ".25\" x .375\" min", action: "Instant Pricing", type: "solid" },
                { label: "B", size: "30\" x 44\" max", action: "Instant Pricing", type: "solid" },
                { label: "C", size: "30\" x 56\" max", action: "Custom Quote", type: "outline" }
            ],
            thicknesses: [
                { value: ".030\"", metric: ".76mm" },
                { value: ".048\"", metric: "1.22mm" },
                { value: ".059\"", metric: "1.50mm" },
                { value: ".074\"", metric: "1.88mm" },
                { value: ".104\"", metric: "2.64mm" },
                { value: ".119\"", metric: "3.02mm" },
                { value: ".135\"", metric: "3.43mm" }
            ],
            tolerance: "+/- .005\""
        },
        services: [3, 5, 6, 11, 7, 12],
        specifications: {
            availableServices: ["Laser Cutting", "Bending", "Dimple Forming"],
            generalDetails: [],
            laserCuttingSpecs: [],
            properties: [
                { label: "Material Composition", value: "Iron (Fe): 99.31 – 99.7, Manganese (Mn): 0.3 – 0.5, Carbon (C): 0 – 0.1, Sulfur (S): 0 – 0.05, Phosphorus (P): 0 – 0.04" },
                { label: "Density", value: "490 lb/ft³ (7850 kg/m³)" },
                { label: "Heat treatments process", value: "N/A" },
                { label: "ASTM", value: "A1008-21A-CS-TYPE-B" },
                { label: "Tensile Strength (Ultimate)", value: "54 ksi (372 MPa)" },
                { label: "Tensile Strength (Yield)", value: "45 ksi (310 MPa)" },
                { label: "Shear Strength", value: "34 ksi (234 MPa)" },
                { label: "Shear Modulus", value: "11000 ksi (76 GPa)" },
                { label: "Fatigue Strength", value: "32 ksi (220 MPa)" },
                { label: "Brinell Hardness", value: "100" },
                { label: "Elongation at Break", value: "22%" },
                { label: "Elastic Modulus", value: "27000 ksi (186 GPa)" },
                { label: "Poisson’s Ratio", value: ".29" },
                { label: "Thermal Conductivity", value: "43 BTU/h-ft °F (74 W/m·K)" },
                { label: "Melting Point", value: "2600 °F (1427 °C)" },
                { label: "Magnetic", value: "Yes" },
                { label: "Does it Rust", value: "Yes" }
            ]
        },
        thicknessSpecs: {
            ".030\"": {
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.030\"", mm: "0.762 mm" },
                    { label: "Gauge", inch: "22", mm: "22" },
                    { label: "Thickness tolerance positive", inch: "0.003\"", mm: "0.0762 mm" },
                    { label: "Thickness tolerance negative", inch: "0.003\"", mm: "0.0762 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".015\"", mm: "0.381 mm" },
                    { label: "Min bridge size", inch: ".015\"", mm: "0.381 mm" },
                    { label: "Min hole to edge distance", inch: ".020\"", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat) 90°", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after) 90°", inch: "0.286\"", mm: "7.264 mm" },
                    { label: "Min Length Center Line 91-130°", inch: "0.344\"", mm: "8.738 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.045\"", mm: "1.143 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Minimum bend angle", inch: "5°", mm: "5°" },
                    { label: "Bend angle tolerance (<= 24\")", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (> 24\")", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.061\"", mm: "1.549 mm" },
                    { label: "K Factor", inch: "0.38", mm: "0.38" },
                    { label: "Bend relief depth", inch: "0.095\"", mm: "2.413 mm" },
                    { label: "Min joggle (BL to BL @ 90°)", inch: "0.288\"", mm: "7.315 mm" },
                    { label: "Max joggle (BL to BL @ 90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.200\" x 5.200\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: ".500\"", mm: "12.7 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple height (.500\" dimple)", inch: ".125\"", mm: "3.175 mm" },
                    { label: "Dimple height (.750\" dimple)", inch: ".127\"", mm: "3.226 mm" },
                    { label: "Dimple height (1.000\" dimple)", inch: ".170\"", mm: "4.318 mm" },
                    { label: "Dimple height (1.250\" dimple)", inch: ".183\"", mm: "4.648 mm" },
                    { label: "Dimple height (1.500\" dimple)", inch: ".200\"", mm: "5.08 mm" },
                    { label: "Dimple height (1.750\" dimple)", inch: ".208\"", mm: "5.283 mm" },
                    { label: "Dimple height (2.000\" dimple)", inch: ".225\"", mm: "5.715 mm" },
                    { label: "Dimple height (2.500\" dimple)", inch: ".285\"", mm: "7.239 mm" },
                    { label: "Dimple height (3.000\" dimple)", inch: ".365\"", mm: "9.271 mm" }
                ]
            },
            ".048\"": {
                availableServices: ["Laser Cutting", "Bending", "Dimple Forming", "Hardware", "Powder Coating"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.048\"", mm: "1.219 mm" },
                    { label: "Gauge", inch: "18", mm: "18" },
                    { label: "Thickness tolerance positive", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Thickness tolerance negative", inch: "0.004\"", mm: "0.1016 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".018\"", mm: "0.457 mm" },
                    { label: "Min bridge size", inch: ".024\"", mm: "0.61 mm" },
                    { label: "Min hole to edge distance", inch: ".020\"", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat) 90°", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after) 90°", inch: "0.298\"", mm: "7.569 mm" },
                    { label: "Min Length Center Line 91-130°", inch: "0.344\"", mm: "8.738 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.045\"", mm: "1.143 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (<= 24\")", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (> 24\")", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.086\"", mm: "2.184 mm" },
                    { label: "K Factor", inch: "0.38", mm: "0.38" },
                    { label: "Bend relief depth", inch: "0.113\"", mm: "2.87 mm" },
                    { label: "Min joggle (BL to BL @ 90°)", inch: "0.308\"", mm: "7.823 mm" },
                    { label: "Max joggle (BL to BL @ 90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.200\" x 5.200\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: ".500\"", mm: "12.7 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple height (.500\" dimple)", inch: ".140\"", mm: "3.556 mm" },
                    { label: "Dimple height (.750\" dimple)", inch: ".150\"", mm: "3.81 mm" },
                    { label: "Dimple height (1.000\" dimple)", inch: ".190\"", mm: "4.826 mm" },
                    { label: "Dimple height (1.250\" dimple)", inch: ".200\"", mm: "5.08 mm" },
                    { label: "Dimple height (1.500\" dimple)", inch: ".220\"", mm: "5.588 mm" },
                    { label: "Dimple height (1.750\" dimple)", inch: ".235\"", mm: "5.969 mm" },
                    { label: "Dimple height (2.000\" dimple)", inch: ".250\"", mm: "6.35 mm" },
                    { label: "Dimple height (2.500\" dimple)", inch: ".270\"", mm: "6.858 mm" },
                    { label: "Dimple height (3.000\" dimple)", inch: ".385\"", mm: "9.779 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specifications", inch: "Please view our Hardware Catalog", mm: "Please view our Hardware Catalog" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ]
            },
            ".059\"": {
                availableServices: ["Laser Cutting", "Bending", "Dimple Forming", "Hardware", "Powder Coating", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.059\"", mm: "1.499 mm" },
                    { label: "Gauge", inch: "16", mm: "16" },
                    { label: "Thickness tolerance positive", inch: "0.006\"", mm: "0.1524 mm" },
                    { label: "Thickness tolerance negative", inch: "0.004\"", mm: "0.1016 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".022\"", mm: "0.559 mm" },
                    { label: "Min bridge size", inch: ".030\"", mm: "0.762 mm" },
                    { label: "Min hole to edge distance", inch: ".020\"", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat) 90°", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after) 90°", inch: "0.309\"", mm: "7.849 mm" },
                    { label: "Min Length Center Line 91-130°", inch: "0.344\"", mm: "8.738 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.063\"", mm: "1.6 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (<= 24\")", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (> 24\")", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.108\"", mm: "2.743 mm" },
                    { label: "K Factor", inch: "0.40", mm: "0.40" },
                    { label: "Bend relief depth", inch: "0.142\"", mm: "3.607 mm" },
                    { label: "Min joggle (BL to BL @ 90°)", inch: "0.320\"", mm: "8.128 mm" },
                    { label: "Max joggle (BL to BL @ 90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.200\" x 5.200\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: ".500\"", mm: "12.7 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple height (.500\" dimple)", inch: ".151\"", mm: "3.835 mm" },
                    { label: "Dimple height (.750\" dimple)", inch: ".155\"", mm: "3.937 mm" },
                    { label: "Dimple height (1.000\" dimple)", inch: ".200\"", mm: "5.08 mm" },
                    { label: "Dimple height (1.250\" dimple)", inch: ".215\"", mm: "5.461 mm" },
                    { label: "Dimple height (1.500\" dimple)", inch: ".230\"", mm: "5.842 mm" },
                    { label: "Dimple height (1.750\" dimple)", inch: ".248\"", mm: "6.299 mm" },
                    { label: "Dimple height (2.000\" dimple)", inch: ".260\"", mm: "6.604 mm" },
                    { label: "Dimple height (2.500\" dimple)", inch: ".315\"", mm: "8.001 mm" },
                    { label: "Dimple height (3.000\" dimple)", inch: ".400\"", mm: "10.16 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specifications", inch: "Please view our Hardware Catalog", mm: "Please view our Hardware Catalog" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M3 x 0.5", mm: "M3 x 0.5" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.1 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.020\"", mm: "0.508 mm" },
                ]
            },
            ".074\"": {
                availableServices: ["Laser Cutting", "Bending", "Dimple Forming", "Hardware", "Powder Coating", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.074\"", mm: "1.88 mm" },
                    { label: "Gauge", inch: "14", mm: "14" },
                    { label: "Thickness tolerance positive", inch: "0.006\"", mm: "0.1524 mm" },
                    { label: "Thickness tolerance negative", inch: "0.004\"", mm: "0.1016 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".028\"", mm: "0.7112 mm" },
                    { label: "Min bridge size", inch: ".032\"", mm: "0.8128 mm" },
                    { label: "Min hole to edge distance", inch: ".022\"", mm: "0.5588 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat) 90°", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after) 90°", inch: "0.320\"", mm: "8.128 mm" },
                    { label: "Min Length Center Line 91-130°", inch: ".344\"", mm: "8.738 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.063\"", mm: "1.6 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (<= 24\")", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (> 24\")", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.129\"", mm: "3.277 mm" },
                    { label: "K Factor", inch: "0.40", mm: "0.40" },
                    { label: "Bend relief depth", inch: "0.157\"", mm: "3.988 mm" },
                    { label: "Min joggle (BL to BL @ 90°)", inch: "0.336\"", mm: "8.534 mm" },
                    { label: "Max joggle (BL to BL @ 90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.950\" x 5.200\"", mm: "49.53 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: "1.000\"", mm: "25.4 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple height (1.000\" dimple)", inch: ".250\"", mm: "6.35 mm" },
                    { label: "Dimple height (1.250\" dimple)", inch: ".230\"", mm: "5.842 mm" },
                    { label: "Dimple height (1.500\" dimple)", inch: ".250\"", mm: "6.35 mm" },
                    { label: "Dimple height (1.750\" dimple)", inch: ".266\"", mm: "6.756 mm" },
                    { label: "Dimple height (2.000\" dimple)", inch: ".285\"", mm: "7.239 mm" },
                    { label: "Dimple height (2.500\" dimple)", inch: ".345\"", mm: "8.763 mm" },
                    { label: "Dimple height (3.000\" dimple)", inch: ".415\"", mm: "10.541 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specifications", inch: "Please view our Hardware Catalog", mm: "Please view our Hardware Catalog" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M6 x 1.0", mm: "M6 x 1.0" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.1 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.022\"", mm: "0.5588 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.022\"", mm: "Tap hole size/2 +0.5588 mm" }
                ],
                properties: [
                    { label: "Elongation at Break", value: "12%" }
                ]
            },
            ".104\"": {
                availableServices: ["Laser Cutting", "Bending", "Dimple Forming", "Hardware", "Powder Coating", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.104\"", mm: "2.642 mm" },
                    { label: "Gauge", inch: "12", mm: "12" },
                    { label: "Thickness tolerance positive", inch: "0.007\"", mm: "0.1778 mm" },
                    { label: "Thickness tolerance negative", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".040\"", mm: "1.016 mm" },
                    { label: "Min bridge size", inch: ".035\"", mm: "0.889 mm" },
                    { label: "Min hole to edge distance", inch: ".031\"", mm: "0.7874 mm" },
                    { label: "Tab and slot tolerance", inch: ".015\"", mm: "0.381 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat) 90°", inch: "0.368\"", mm: "9.347 mm" },
                    { label: "Min flange length (after) 90°", inch: "0.459\"", mm: "11.659 mm" },
                    { label: "Minimum Length Center line 91-130°", inch: ".497\"", mm: "12.624 mm" },
                    { label: "Die width", inch: "0.630\"", mm: "16 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.063\"", mm: "1.6 mm" },
                    { label: "Minimum bend angle", inch: "5°", mm: "5°" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (<= 24\")", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (> 24\")", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.181\"", mm: "4.597 mm" },
                    { label: "K Factor", inch: "0.34", mm: "0.34" },
                    { label: "Bend relief depth", inch: "0.187\"", mm: "4.75 mm" },
                    { label: "Min joggle (BL to BL @ 90°)", inch: "0.482\"", mm: "12.243 mm" },
                    { label: "Max joggle (BL to BL @ 90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "2.450\" x 5.200\"", mm: "62.23 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: "1.250\"", mm: "31.75 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple height (1.250\" dimple)", inch: ".265\"", mm: "6.731 mm" },
                    { label: "Dimple height (1.500\" dimple)", inch: ".276\"", mm: "7.01 mm" },
                    { label: "Dimple height (1.750\" dimple)", inch: ".305\"", mm: "7.747 mm" },
                    { label: "Dimple height (2.000\" dimple)", inch: ".315\"", mm: "8.001 mm" },
                    { label: "Dimple height (2.500\" dimple)", inch: ".375\"", mm: "9.525 mm" },
                    { label: "Dimple height (3.000\" dimple)", inch: ".455\"", mm: "11.557 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specifications", inch: "Please view our Hardware Catalog", mm: "Please view our Hardware Catalog" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/4-28", mm: "1/4-28" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.1 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 36\"", mm: "914.4 mm x 914.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.031\"", mm: "0.787 mm" },
                ]
            },
            ".119\"": {
                availableServices: ["Laser Cutting", "Bending", "Dimple Forming", "Hardware", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.119\"", mm: "3.023 mm" },
                    { label: "Gauge", inch: "11", mm: "11" },
                    { label: "Thickness tolerance positive", inch: "0.007\"", mm: "0.1778 mm" },
                    { label: "Thickness tolerance negative", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".040\"", mm: "1.016 mm" },
                    { label: "Min bridge size", inch: ".035\"", mm: "0.889 mm" },
                    { label: "Min hole to edge distance", inch: ".036\"", mm: "0.9144 mm" },
                    { label: "Tab and slot tolerance", inch: ".015\"", mm: "0.381 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat) 90°", inch: "0.368\"", mm: "9.347 mm" },
                    { label: "Min flange length (after) 90°", inch: "0.466\"", mm: "11.836 mm" },
                    { label: "Min Length Center Line 91-130°", inch: "0.497\"", mm: "12.624 mm" },
                    { label: "Die width", inch: "0.630\"", mm: "16 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.063\"", mm: "1.6 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (<= 24\")", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (> 24\")", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.196\"", mm: "4.978 mm" },
                    { label: "K Factor", inch: "0.38", mm: "0.38" },
                    { label: "Bend relief depth", inch: "0.202\"", mm: "5.131 mm" },
                    { label: "Min joggle (BL to BL @ 90°)", inch: "0.499\"", mm: "12.675 mm" },
                    { label: "Max joggle (BL to BL @ 90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "2.450\" x 5.200\"", mm: "62.23 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: "1.250\"", mm: "31.75 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple height (1.250\" dimple)", inch: ".270\"", mm: "6.858 mm" },
                    { label: "Dimple height (1.500\" dimple)", inch: ".285\"", mm: "7.239 mm" },
                    { label: "Dimple height (1.750\" dimple)", inch: ".310\"", mm: "7.874 mm" },
                    { label: "Dimple height (2.000\" dimple)", inch: ".328\"", mm: "8.331 mm" },
                    { label: "Dimple height (2.500\" dimple)", inch: ".390\"", mm: "9.906 mm" },
                    { label: "Dimple height (3.000\" dimple)", inch: ".470\"", mm: "11.938 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specifications", inch: "Please view our Hardware Catalog", mm: "Please view our Hardware Catalog" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "5/16-24", mm: "5/16-24" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.1 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.036\"", mm: "0.9144 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.036\"", mm: "Tap hole size/2 +0.9144 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".135\"": {
                availableServices: ["Laser Cutting", "Bending", "Hardware", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.135\"", mm: "3.429 mm" },
                    { label: "Gauge", inch: "10", mm: "10" },
                    { label: "Thickness tolerance positive", inch: "0.006\"", mm: "0.1524 mm" },
                    { label: "Thickness tolerance negative", inch: "0.006\"", mm: "0.1524 mm" },
                    { label: "Mill Finish", inch: "Cold Rolled", mm: "Cold Rolled" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.030 per foot" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".051\"", mm: "1.2954 mm" },
                    { label: "Min bridge size", inch: ".055\"", mm: "1.397 mm" },
                    { label: "Min hole to edge distance", inch: ".041\"", mm: "1.0414 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat) 90°", inch: "0.620\"", mm: "15.748 mm" },
                    { label: "Min flange length (after) 90°", inch: "0.742\"", mm: "18.847 mm" },
                    { label: "Min Length Center Line 91-130°", inch: "0.837\"", mm: "21.26 mm" },
                    { label: "Die width", inch: "0.984\"", mm: "25 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.100\"", mm: "2.54 mm" },
                    { label: "Max bend angle", inch: "110°", mm: "110°" },
                    { label: "Minimum bend angle", inch: "5°", mm: "5°" },
                    { label: "Bend angle tolerance (<= 24\")", inch: "+/- 1 degree", mm: "+/- 1 degree" },
                    { label: "Bend angle tolerance (> 24\")", inch: "+/- 2 degrees", mm: "+/- 2 degrees" },
                    { label: "Bend deduction @ 90°", inch: "0.244\"", mm: "6.198 mm" },
                    { label: "K Factor", inch: "0.32", mm: "0.32" },
                    { label: "Bend relief depth", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min joggle (BL to BL @ 90°)", inch: "0.769\"", mm: "19.533 mm" },
                    { label: "Max joggle (BL to BL @ 90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1\" x 1.5\"", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Min dist bend to hardware center", inch: "0.488\"", mm: "12.395 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specifications", inch: "Please view our Hardware Catalog", mm: "Please view our Hardware Catalog" }
                ],
                platingSpecs: [
                    { label: "Min Plating Part Size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max Plating Part Size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "30\" x 36\"", mm: "762 mm x 914.4 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M10 x 1.5", mm: "M10 x 1.5" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.1 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.041\"", mm: "1.041 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.041\"", mm: "Tap hole size/2 +1.041 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            }
        },
        aboutSection: {
            title: "What is 1008 Cold Rolled Carbon Steel?",
            text: "Our cold-rolled carbon steel is our customers' favorite material to work with. Cold-rolled is just hot-rolled steel with additional processing. Those additional processes give it a cleaner edge, better surface quality, and more exact dimensions. Cold-rolled has exceptional refinement and tends to be a little stronger and harder than hot-rolled. For these reasons, cold-rolled is better suited for bending and fabrication.",
            image: coldRolledParts,
            featureChart: [
                { label: "Strength", rating: 2 },
                { label: "Corrosion Resistance", rating: 3 },
                { label: "Weldability", rating: 5 },
                { label: "Toughness", rating: 2 },
                { label: "Formability", rating: 5 },
                { label: "Machinability", rating: 3 },
                { label: "Heat Treating", rating: 2 },
                { label: "Strength-to-Weight Ratio", rating: 2 }
            ],
            capabilities: {
                title: "What can you make with 1008 Cold Rolled Carbon Steel parts?",
                text: "Recognized for its cost-effectiveness, strength, and versatile nature, mild steel plays a pivotal role in a myriad of applications across different industries. Its widespread usage stems from its malleability and weldability, making it a favored material for fabricators and manufacturers. From providing the structural backbone in construction to forming the basis for automotive components, mild steel finds its place in an extensive array of products and structures.",
                items: [
                    "Structural steel",
                    "Signs",
                    "Fencing",
                    "Furniture",
                    "Automotive applications",
                    "Electronic enclosures",
                    "General fabrication",
                    "Decorations",
                    "And so much more!"
                ]
            }
        },
        faqs: [
            {
                question: "What thicknesses does DMS Engineering offer 1008 Cold Rolled Carbon Steel in?",
                answer: "Choose from seven thicknesses including .030\"(0.76mm), .048\"(1.22mm), .59\"(1.50mm), .074\"(1.88mm), .104\"(2.64mm), .119\"(3.02mm), and .135\"(3.43mm)."
            },
            {
                question: "What are the minimum and maximum sizes for cutting 1008 Cold Rolled Carbon Steel?",
                answer: "1008 Cold Rolled Carbon Steel is available at DMS Engineering with a range of thicknesses and part sizes. Instant quotes are possible for dimensions between .25\" x .375\" and 30\" x 44\", while custom quoting extends the maximum size to 30\" x 56\"."
            },
            {
                question: "What additional services are available for 1008 Cold Rolled Carbon Steel?",
                answer: "You can add the following services to your 1008 Cold Rolled Carbon Steel parts: Bending, Dimple Forming, Hardware Insertion, Plating, Powder Coating, Tapping, and Tumbling"
            }
        ]
    },
    {
        id: 22,
        name: "HRP&O (A36/A1018)",
        thickness: "Thicknesses: .187\" – .250\"",
        image: aboutMetal2,
        description: "Hot Rolled Pickled and Oiled steel for improved surface quality.",
        quickLook: { cutSizes: [], thicknesses: [], tolerance: "+/- .005\"" },
        services: [3, 5, 10, 11],
        specifications: { availableServices: ["Laser Cutting", "Bending", "Plating", "Powder Coating"], generalDetails: [], laserCuttingSpecs: [], properties: [] },
        aboutSection: { title: "HRP&O (A36/A1018) Steel", text: "Data coming soon.", items: [] }
    },
    {
        id: 23,
        name: "HOT ROLLED (A36)",
        thickness: "Thicknesses: .313\" – .500\"",
        image: metal3,
        description: "Structural quality steel with excellent weldability.",
        quickLook: { cutSizes: [], thicknesses: [], tolerance: "+/- .005\"" },
        services: [3, 5, 10, 11],
        specifications: { availableServices: ["Laser Cutting", "Bending", "Plating", "Powder Coating"], generalDetails: [], laserCuttingSpecs: [], properties: [] },
        aboutSection: { title: "Hot Rolled A36 Steel", text: "Data coming soon.", items: [] }
    },
    {
        id: 15,
        name: "STAINLESS STEEL (304)",
        thickness: "10 thicknesses: .030\" - .500\"",
        image: metal15,
        description: "Common stainless steel with good corrosion resistance. Widely used in food processing.",
        services: [3, 5, 6, 7, 9, 11, 12],
        quickLook: {
            cutSizes: [
                { label: "A", size: ".25\" x .375\" min", action: "Instant Pricing", type: "solid" },
                { label: "B", size: "30\" x 44\" max", action: "Instant Pricing", type: "solid" },
                { label: "C", size: "30\" x 56\" max", action: "Custom Quote", type: "outline" }
            ],
            thicknesses: [
                { value: ".030\"", metric: ".76mm" },
                { value: ".048\"", metric: "1.22mm" },
                { value: ".060\"", metric: "1.524mm" },
                { value: ".074\"", metric: "1.8796mm" },
                { value: ".100\"", metric: "2.54mm" },
                { value: ".125\"", metric: "3.18mm" },
                { value: ".187\"", metric: "4.75mm" },
                { value: ".250\"", metric: "6.35mm" },
                { value: ".375\"", metric: "9.53mm" },
                { value: ".500\"", metric: "12.7mm" }
            ],
            tolerance: "+/- .005\""
        },
        specifications: {
            availableServices: [
                "Laser Cutting",
                "Bending",
                "Deburring",
                "Dimple Forming",
                "Hardware Insertion",
                "Powder Coating",
                "Tapping",
                "Tumbling",
                "Plating",
                "Anodizing",
                "Countersinking"
            ],
            properties: [
                { label: "Material Composition", value: "Iron (Fe): 65 – 74 Chromium (Cr): 18 – 20 Nickel (Ni): 8.0 – 12 Manganese (Mn): 0 – 2.0 Silicon (Si): 0 – 0.75 Nitrogen (N): 0 – 0.1 Phosphorus (P): 0 – 0.045 Carbon (C): 0 – 0.030 Sulfur (S): 0 – 0.030" },
                { label: "Density", value: "494.208 lb/ft^3" },
                { label: "Heat treatments process", value: "N/A" },
                { label: "ASTM", value: "A240M-20a/A480M-20a" },
                { label: "Tensile Strength (Ultimate)", value: "85 ksi" },
                { label: "Tensile Strength (Yield)", value: "35 ksi" },
                { label: "Shear Strength", value: "30 ksi" },
                { label: "Shear Modulus", value: "11.5 ksi" },
                { label: "Fatigue Strength", value: "30 ksi" },
                { label: "Brinell Hardness", value: "123" },
                { label: "Elongation at Break", value: "50%" },
                { label: "Elastic Modulus", value: "29000 ksi" },
                { label: "Poisson’s Ratio", value: ".29" },
                { label: "Thermal Conductivity", value: "9.4 BTU/h-ft °F" },
                { label: "Melting Point", value: "2550 °F" },
                { label: "Magnetic", value: "No" },
                { label: "Does it Rust", value: "No" }
            ]
        },
        thicknessSpecs: {
            ".030\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Bending", "Dimple Forming"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.030\"", mm: "0.762 mm" },
                    { label: "Gauge", inch: "22", mm: "22" },
                    { label: "Thickness tolerance positive", inch: "0.002\"", mm: "0.051 mm" },
                    { label: "Thickness tolerance negative", inch: "0.002\"", mm: "0.051 mm" },
                    { label: "Mill Finish", inch: "2B", mm: "2B" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".015\"", mm: "0.381 mm" },
                    { label: "Min bridge size", inch: ".015\"", mm: "0.381 mm" },
                    { label: "Min hole to edge distance", inch: ".015\"", mm: "0.381 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.294\"", mm: "7.468 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: ".332\"", mm: "8.433 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.080\"", mm: "2.032 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.079\"", mm: "2.007 mm" },
                    { label: "K Factor", inch: "0.36", mm: "0.36" },
                    { label: "Bend relief depth", inch: "0.130\"", mm: "3.302 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "0.288\"", mm: "7.315 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.200\" x 5.200\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: ".500\"", mm: "12.7 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (.500\" dimple)", inch: ".123\"", mm: "3.124 mm" },
                    { label: "Dimple overall height (.750\" dimple)", inch: ".124\"", mm: "3.150 mm" },
                    { label: "Dimple overall height (1.000\" dimple)", inch: ".168\"", mm: "4.267 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".177\"", mm: "4.496 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".199\"", mm: "5.055 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".210\"", mm: "5.334 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".230\"", mm: "5.842 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".286\"", mm: "7.264 mm" },
                    { label: "Dimple overall height (3.000\" dimple)", inch: ".365\"", mm: "9.271 mm" }
                ]
            },
            ".048\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Dimple Forming", "Hardware", "Powder Coating"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.048\"", mm: "1.22 mm" },
                    { label: "Gauge", inch: "18", mm: "18" },
                    { label: "Thickness tolerance positive", inch: "0.003\"", mm: "0.076 mm" },
                    { label: "Thickness tolerance negative", inch: "0.003\"", mm: "0.076 mm" },
                    { label: "Mill Finish", inch: "2B", mm: "2B" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".019\"", mm: "0.483 mm" },
                    { label: "Min bridge size", inch: ".019\"", mm: "0.483 mm" },
                    { label: "Min hole to edge distance", inch: ".020\"", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.307\"", mm: "7.798 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: ".332\"", mm: "8.433 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.080\"", mm: "2.032 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.105\"", mm: "2.667 mm" },
                    { label: "K Factor", inch: "0.36", mm: "0.36" },
                    { label: "Bend relief depth", inch: "0.148\"", mm: "3.759 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "0.308\"", mm: "7.823 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.200\" x 5.200\"", mm: "30.48 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: ".500\"", mm: "12.7 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (.500\" dimple)", inch: ".139\"", mm: "3.531 mm" },
                    { label: "Dimple overall height (.750\" dimple)", inch: ".143\"", mm: "3.632 mm" },
                    { label: "Dimple overall height (1.000\" dimple)", inch: ".185\"", mm: "4.699 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".200\"", mm: "5.08 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".216\"", mm: "5.486 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".228\"", mm: "5.791 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".245\"", mm: "6.223 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".300\"", mm: "7.62 mm" },
                    { label: "Dimple overall height (3.000\" dimple)", inch: ".375\"", mm: "9.525 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1″ x 1.5″", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36″ x 46″", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ]
            },
            ".060\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Dimple Forming", "Hardware", "Powder Coating", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.060\"", mm: "1.524 mm" },
                    { label: "Gauge", inch: "16", mm: "16" },
                    { label: "Thickness tolerance positive", inch: "0.003\"", mm: "0.076 mm" },
                    { label: "Thickness tolerance negative", inch: "0.003\"", mm: "0.076 mm" },
                    { label: "Mill Finish", inch: "2B", mm: "2B" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".024\"", mm: "0.610 mm" },
                    { label: "Min bridge size", inch: ".024\"", mm: "0.610 mm" },
                    { label: "Min hole to edge distance", inch: ".020\"", mm: "0.508 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.314\"", mm: "7.976 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: ".332\"", mm: "8.433 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.070\"", mm: "1.778 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.119\"", mm: "3.023 mm" },
                    { label: "K Factor", inch: "0.34", mm: "0.34" },
                    { label: "Bend relief depth", inch: "0.150\"", mm: "3.81 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "0.321\"", mm: "8.153 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.450\" x 5.200\"", mm: "36.83 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: ".750\"", mm: "19.05 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (.750\" dimple)", inch: ".158\"", mm: "4.013 mm" },
                    { label: "Dimple overall height (1.000\" dimple)", inch: ".200\"", mm: "5.08 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".212\"", mm: "5.385 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".234\"", mm: "5.944 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".243\"", mm: "6.172 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".285\"", mm: "7.239 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".320\"", mm: "8.128 mm" },
                    { label: "Dimple overall height (3.000\" dimple)", inch: ".405\"", mm: "10.287 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1″ x 1.5″", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36″ x 46″", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M6 x 1.0", mm: "M6 x 1.0" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.020\"", mm: "0.508 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.020\"", mm: "Tap hole size/2 +0.508 mm" }
                ]
            },
            ".074\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Dimple Forming", "Hardware", "Powder Coating", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.074\"", mm: "1.88 mm" },
                    { label: "Gauge", inch: "14", mm: "14" },
                    { label: "Thickness tolerance positive", inch: "0.006\"", mm: "0.152 mm" },
                    { label: "Thickness tolerance negative", inch: "0.002\"", mm: "0.051 mm" },
                    { label: "Mill Finish", inch: "2B", mm: "2B" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".030\"", mm: "0.762 mm" },
                    { label: "Min bridge size", inch: ".030\"", mm: "0.762 mm" },
                    { label: "Min hole to edge distance", inch: ".022\"", mm: "0.559 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.255\"", mm: "6.477 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.324\"", mm: "8.230 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: ".332\"", mm: "8.433 mm" },
                    { label: "Die width", inch: "0.472\"", mm: "11.989 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.075\"", mm: "1.905 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.137\"", mm: "3.480 mm" },
                    { label: "K Factor", inch: "0.36", mm: "0.36" },
                    { label: "Bend relief depth", inch: "0.169\"", mm: "4.293 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "0.336\"", mm: "8.534 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "1.950\" x 5.200\"", mm: "49.53 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: "1.000\"", mm: "25.4 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (1.000\" dimple)", inch: ".210\"", mm: "5.334 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".230\"", mm: "5.842 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".252\"", mm: "6.401 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".262\"", mm: "6.655 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".280\"", mm: "7.112 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".330\"", mm: "8.382 mm" },
                    { label: "Dimple overall height (3.000\" dimple)", inch: ".405\"", mm: "10.287 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1″ x 1.5″", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36″ x 46″", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M6 x 1.0", mm: "6 mm x 1.0" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "2 mm x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.022\"", mm: "0.559 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.022\"", mm: "Tap hole size/2 +0.559 mm" }
                ]
            },
            ".100\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Dimple Forming", "Hardware", "Powder Coating", "Tapping"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.100\"", mm: "2.54 mm" },
                    { label: "Gauge", inch: "12", mm: "12" },
                    { label: "Thickness tolerance positive", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Thickness tolerance negative", inch: "0.004\"", mm: "0.102 mm" },
                    { label: "Mill Finish", inch: "2B", mm: "2B" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".040\"", mm: "1.016 mm" },
                    { label: "Min bridge size", inch: ".040\"", mm: "1.016 mm" },
                    { label: "Min hole to edge distance", inch: ".030\"", mm: "0.762 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "44\"", mm: "1117.6 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.620\"", mm: "15.748 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.732\"", mm: "18.593 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "0.806\"", mm: "20.472 mm" },
                    { label: "Die width", inch: "0.984\"", mm: "24.994 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.187\"", mm: "4.750 mm" },
                    { label: "Max bend angle", inch: "130°", mm: "130°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.223\"", mm: "5.664 mm" },
                    { label: "K Factor", inch: "0.36", mm: "0.36" },
                    { label: "Bend relief depth", inch: "0.307\"", mm: "7.798 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "0.730\"", mm: "18.542 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "2.450\" x 5.200\"", mm: "62.23 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: "1.250\"", mm: "31.75 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".250\"", mm: "6.35 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".270\"", mm: "6.858 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".288\"", mm: "7.315 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".305\"", mm: "7.747 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".360\"", mm: "9.144 mm" },
                    { label: "Dimple overall height (3.000\" dimple)", inch: ".430\"", mm: "10.922 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1″ x 1.5″", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36″ x 46″", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/4-28", mm: "1/4-28" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "M2 x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.030\"", mm: "0.762 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.030\"", mm: "Tap hole size/2 +0.762 mm" }
                ]
            },
            ".125\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Dimple Forming", "Hardware", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.125\"", mm: "3.18 mm" },
                    { label: "Gauge", inch: "11", mm: "11" },
                    { label: "Thickness tolerance positive", inch: "0.010\"", mm: "0.254 mm" },
                    { label: "Thickness tolerance negative", inch: "0.030\"", mm: "0.762 mm" },
                    { label: "Mill Finish", inch: "2B", mm: "2B" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Min hole size", inch: ".050\"", mm: "1.27 mm" },
                    { label: "Min bridge size", inch: ".050\"", mm: "1.27 mm" },
                    { label: "Min hole to edge distance", inch: ".038\"", mm: "0.965 mm" },
                    { label: "Tab and slot tolerance", inch: ".010\"", mm: "0.254 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "40\"", mm: "1016 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.620\"", mm: "15.748 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.740\"", mm: "18.796 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "0.806\"", mm: "20.472 mm" },
                    { label: "Die width", inch: "0.984\"", mm: "24.994 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.150\"", mm: "3.810 mm" },
                    { label: "Max bend angle", inch: "120°", mm: "120°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.240\"", mm: "6.096 mm" },
                    { label: "K Factor", inch: "0.38", mm: "0.38" },
                    { label: "Bend relief depth", inch: "0.295\"", mm: "7.493 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "0.758\"", mm: "19.253 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                dimpleSpecs: [
                    { label: "Min dimple part size", inch: "2.450\" x 5.200\"", mm: "62.23 mm x 132.08 mm" },
                    { label: "Max dimple part size", inch: "26\" x 56\"", mm: "660.4 mm x 1422.4 mm" },
                    { label: "Smallest dimple", inch: "1.250\"", mm: "31.75 mm" },
                    { label: "Largest dimple", inch: "3.000\"", mm: "76.2 mm" },
                    { label: "Dimple overall height (1.250\" dimple)", inch: ".270\"", mm: "6.858 mm" },
                    { label: "Dimple overall height (1.500\" dimple)", inch: ".285\"", mm: "7.239 mm" },
                    { label: "Dimple overall height (1.750\" dimple)", inch: ".315\"", mm: "8.001 mm" },
                    { label: "Dimple overall height (2.000\" dimple)", inch: ".320\"", mm: "8.128 mm" },
                    { label: "Dimple overall height (2.500\" dimple)", inch: ".380\"", mm: "9.652 mm" },
                    { label: "Dimple overall height (3.000\" dimple)", inch: ".440\"", mm: "11.176 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1″ x 1.5″", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36″ x 46″", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "M10 x 1.5", mm: "10 mm x 1.5" },
                    { label: "Smallest Tap", inch: "M2 x 0.4", mm: "2 mm x 0.4" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.038\"", mm: "0.965 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.038\"", mm: "Tap hole size/2 +0.965 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".187\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Hardware", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.187\"", mm: "4.75 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.045\"", mm: "1.143 mm" },
                    { label: "Thickness tolerance negative", inch: "0.045\"", mm: "1.143 mm" },
                    { label: "Mill Finish", inch: "#1 HRAP", mm: "#1 HRAP" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Recommended Min hole size", inch: ".075\"", mm: "1.905 mm" },
                    { label: "Min hole size", inch: ".042\"", mm: "1.067 mm" },
                    { label: "Min bridge size", inch: ".055\"", mm: "1.397 mm" },
                    { label: "Min hole to edge distance", inch: ".055\"", mm: "1.397 mm" },
                    { label: "Tab and slot tolerance", inch: ".050\"", mm: "1.27 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "36\"", mm: "914.4 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "0.620\"", mm: "15.748 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "0.784\"", mm: "19.914 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "N/A", mm: "N/A" },
                    { label: "Die width", inch: "0.984\"", mm: "24.994 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.130\"", mm: "3.302 mm" },
                    { label: "Max bend angle", inch: "90°", mm: "90°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.329\"", mm: "8.357 mm" },
                    { label: "K Factor", inch: "0.35", mm: "0.35" },
                    { label: "Bend relief depth", inch: "0.337\"", mm: "8.560 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "0.826\"", mm: "20.980 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1″ x 1.5″", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36″ x 46″", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "M3 x 0.5", mm: "3 mm x 0.5" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.055\"", mm: "1.397 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.055\"", mm: "Tap hole size/2 +1.397 mm" },
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".250\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Bending", "Deburring", "Hardware", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.250\"", mm: "6.35 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.045\"", mm: "1.143 mm" },
                    { label: "Thickness tolerance negative", inch: "0.045\"", mm: "1.143 mm" },
                    { label: "Mill Finish", inch: "#1 HRAP", mm: "#1 HRAP" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".25\" x .375\"", mm: "6.35 mm x 9.525 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Recommended Min hole size", inch: ".080\"", mm: "2.032 mm" },
                    { label: "Min hole size", inch: ".057\"", mm: "1.448 mm" },
                    { label: "Min bridge size", inch: ".060\"", mm: "1.524 mm" },
                    { label: "Min hole to edge distance", inch: ".060\"", mm: "1.524 mm" },
                    { label: "Tab and slot tolerance", inch: ".050\"", mm: "1.27 mm" }
                ],
                bendingSpecs: [
                    { label: "Min bend part size", inch: ".375\" x 1.5\"", mm: "9.525 mm x 38.1 mm" },
                    { label: "Max bending flat part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Max bend length", inch: "36\"", mm: "914.4 mm" },
                    { label: "Min flange length (before/Flat Pattern) 90° or less", inch: "1.150\"", mm: "29.210 mm" },
                    { label: "Min flange length (after bend) 90° or less", inch: "1.381\"", mm: "35.077 mm" },
                    { label: "Minimum Length Center of bend line 91-130° (Acute)", inch: "N/A", mm: "N/A" },
                    { label: "Die width", inch: "1.575\"", mm: "40.005 mm" },
                    { label: "Effective bend radius @ 90°", inch: "0.225\"", mm: "5.715 mm" },
                    { label: "Max bend angle", inch: "90°", mm: "90°" },
                    { label: "Bend angle tolerance (up to 24 in)", inch: "+/- 1°", mm: "+/- 1°" },
                    { label: "Bend angle tolerance (over 24 in)", inch: "+/- 2°", mm: "+/- 2°" },
                    { label: "Bend deduction @ 90°", inch: "0.462\"", mm: "11.735 mm" },
                    { label: "K Factor", inch: "0.34", mm: "0.34" },
                    { label: "Bend relief depth", inch: "0.495\"", mm: "12.573 mm" },
                    { label: "Minimum joggle (Bend line to bend line @90°)", inch: "1.425\"", mm: "36.195 mm" },
                    { label: "Maximum joggle (Bend line to bend line @90°)", inch: "3.750\"", mm: "95.25 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1″ x 1.5″", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36″ x 46″", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "3\"", mm: "76.2 mm" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "M4 x 0.7", mm: "4 mm x 0.7" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.060\"", mm: "1.524 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.060\"", mm: "Tap hole size/2 +1.524 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".375\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Deburring", "Hardware", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.375\"", mm: "9.525 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.055\"", mm: "1.397 mm" },
                    { label: "Thickness tolerance negative", inch: "0.055\"", mm: "1.397 mm" },
                    { label: "Mill Finish", inch: "#1 HRAP", mm: "#1 HRAP" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".500\" x .500\"", mm: "12.7 mm x 12.7 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Recommended Min hole size", inch: ".150\"", mm: "3.81 mm" },
                    { label: "Min hole size", inch: ".085\"", mm: "2.159 mm" },
                    { label: "Min bridge size", inch: ".150\"", mm: "3.81 mm" },
                    { label: "Min hole to edge distance", inch: ".113\"", mm: "2.870 mm" },
                    { label: "Tab and slot tolerance", inch: ".060\"", mm: "1.524 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1″ x 1.5″", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36″ x 46″", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "M6 x 1.0", mm: "6 mm x 1.0" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 46\"", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.113\"", mm: "2.870 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.113\"", mm: "Tap hole size/2 +2.870 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            },
            ".500\"": {
                showcaseImages: [],
                availableServices: ["Laser Cutting", "Deburring", "Hardware", "Powder Coating", "Tapping", "Tumbling"],
                generalDetails: [
                    { label: "Advertised Thickness", inch: "0.500\"", mm: "12.7 mm" },
                    { label: "Gauge", inch: "N/A", mm: "N/A" },
                    { label: "Thickness tolerance positive", inch: "0.055\"", mm: "1.397 mm" },
                    { label: "Thickness tolerance negative", inch: "0.055\"", mm: "1.397 mm" },
                    { label: "Mill Finish", inch: "#1 HRAP", mm: "#1 HRAP" },
                    { label: "Top/Bottom finish", inch: "Identical both sides", mm: "Identical both sides" },
                    { label: "Sourced from", inch: "USA/Global", mm: "USA/Global" }
                ],
                laserCuttingSpecs: [
                    { label: "Cutting process", inch: "Fiber laser", mm: "Fiber laser" },
                    { label: "Cut tolerance +/-", inch: "0.005\"", mm: "0.127 mm" },
                    { label: "Flatness tolerance before cutting", inch: "+/-0.030 per foot", mm: "+/-0.762 mm per 304.8 mm" },
                    { label: "Min part size", inch: ".500\" x .500\"", mm: "12.7 mm x 12.7 mm" },
                    { label: "Max part size", inch: "44\" x 30\"", mm: "1117.6 mm x 762 mm" },
                    { label: "Recommended Min hole size", inch: ".200\"", mm: "5.08 mm" },
                    { label: "Min hole size", inch: ".125\"", mm: "3.175 mm" },
                    { label: "Min bridge size", inch: ".200\"", mm: "5.08 mm" },
                    { label: "Min hole to edge distance", inch: ".150\"", mm: "3.81 mm" },
                    { label: "Tab and slot tolerance", inch: ".060\"", mm: "1.524 mm" }
                ],
                deburringSpecs: [
                    { label: "Min deburring part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max deburring part size", inch: "24\" x 46\"", mm: "609.6 mm x 1168.4 mm" }
                ],
                hardwareSpecs: [
                    { label: "Min hardware part size", inch: "1″ x 1.5″", mm: "25.4 mm x 38.1 mm" },
                    { label: "Max hardware part size", inch: "36″ x 46″", mm: "914.4 mm x 1168.4 mm" },
                    { label: "Max 4 sided box flange height", inch: "N/A", mm: "N/A" },
                    { label: "Hardware specific specifications", inch: "See Catalog", mm: "See Catalog" }
                ],
                powderCoatingSpecs: [
                    { label: "Min powder coating part size", inch: "1\" x 3\"", mm: "25.4 mm x 76.2 mm" },
                    { label: "Max powder coating part size", inch: "23\" x 23\"", mm: "584.2 mm x 584.2 mm" }
                ],
                tappingSpecs: [
                    { label: "Largest Tap", inch: "1/2-20", mm: "1/2-20" },
                    { label: "Smallest Tap", inch: "M6 x 1.0", mm: "6 mm x 1.0" },
                    { label: "Min Flat Part Size Tapping", inch: "0.949\" x 1.5\"", mm: "24.105 mm x 38.1 mm" },
                    { label: "Max Flat Part Size Tapping", inch: "36\" x 36\"", mm: "914.4 mm x 914.4 mm" },
                    { label: "Tapping Min Hole to Edge", inch: "0.150\"", mm: "3.81 mm" },
                    { label: "Tapping Min Hole Center to Material Edge", inch: "Tap hole size/2 +0.150\"", mm: "Tap hole size/2 +3.81 mm" }
                ],
                tumbleSpecs: [
                    { label: "Min Part Size Tumbling", inch: "0.5\" x 1.5\"", mm: "12.7 mm x 38.1 mm" },
                    { label: "Max Part Size Tumbling", inch: "4\" x 7\"", mm: "101.6 mm x 177.8 mm" }
                ]
            }
        },
        aboutSection: {
            title: "What is 304 Stainless Steel?",
            text: "Weldable, formable, and easy to work with, 304 stainless is our first choice for projects that require massive strength and durability.\n\nLaser cut 304 stainless steel is oxidation resistant, making it easy to sanitize and maintain. This particular feature makes 304 stainless steel the go-to grade for many food service applications, from countertops to cookware.",
            image: aboutStainless,
            featureChart: [
                { label: "Strength", rating: 2 },
                { label: "Corrosion Resistance", rating: 5 },
                { label: "Weldability", rating: 5 },
                { label: "Toughness", rating: 2 },
                { label: "Formability", rating: 4 },
                { label: "Machinability", rating: 2 },
                { label: "Heat Treating", rating: 1 },
                { label: "Strength-to-Weight Ratio", rating: 2 }
            ],
            capabilities: {
                title: "What can you make with 304 Stainless Steel parts?",
                text: "Fusion welding performance for 304 stainless steel is excellent both with and without fillers so it's a strong choice across projects that require welding. Heavily welded sections sometimes require additional treatments, such as annealing, but generally the material is simple to weld.\n\nUltimately, you can count on DMS Engineering's 304 stainless steel laser cutting services to meet your project's needs and provide solid parts made to your specifications.",
                items: [
                    "Appliances",
                    "Kitchen equipment",
                    "Blades",
                    "Food processing equipment",
                    "Screws",
                    "Machinery parts",
                    "Architectural",
                    "Utensils",
                    "And so much more!"
                ]
            }
        },
        faqs: [
            {
                question: "What thicknesses does DMS Engineering offer 304 Stainless Steel in?",
                answer: "This material is available in ten thickness options: .030\" (0.76mm), .048\" (1.22mm), .060\" (1.52mm), .074\" (1.88mm), .100\" (2.54mm), .125\" (3.18mm), .187\" (4.75mm), .250\" (6.35mm), .375\" (9.53mm), .500\" (12.7mm)."
            },
            {
                question: "What are the minimum and maximum sizes for cutting 304 Stainless Steel?",
                answer: "DMS Engineering cuts 304 Stainless Steel in a broad range of sizes and thicknesses. Instant quoting is available for parts as small as .25\" x .375\" and as large as 30\" x 44\". Larger parts, up to 30\" x 56\", can be ordered through a custom quote."
            },
            {
                question: "What additional services are available for 304 Stainless Steel?",
                answer: "You can add the following services to your 304 Stainless Steel parts: Bending, Deburring, Dimple Forming, Hardware Insertion, Powder Coating, Tapping, and Tumbling."
            }
        ]
    },
    { id: 16, name: "STAINLESS STEEL (316)", thickness: "Multiple thicknesses available", image: metal16, description: "Superior corrosion resistance, particularly against chlorides and industrial solvents.", quickLook: { cutSizes: [], thicknesses: [], tolerance: "" }, specifications: { availableServices: ["Laser Cutting"], generalDetails: [], laserCuttingSpecs: [], properties: [] } },
    { id: 17, name: "TITANIUM (GRADE 5)", thickness: "Multiple thicknesses available", image: metal17, description: "High strength, low weight, and excellent corrosion resistance. Biomedical and aerospace use.", quickLook: { cutSizes: [], thicknesses: [], tolerance: "" }, specifications: { availableServices: ["Laser Cutting"], generalDetails: [], laserCuttingSpecs: [], properties: [] } },
    { id: 18, name: "TITANIUM (GRADE 2)", thickness: "Multiple thicknesses available", image: metal18, description: "High corrosion resistance and excellent formability. Common in chemical processing.", quickLook: { cutSizes: [], thicknesses: [], tolerance: "" }, specifications: { availableServices: ["Laser Cutting"], generalDetails: [], laserCuttingSpecs: [], properties: [] } }
];

