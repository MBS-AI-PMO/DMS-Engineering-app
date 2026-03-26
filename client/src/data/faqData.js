export const faqCategories = [
    { id: "recent", title: "MOST RECENT" },
    { id: "most-asked", title: "MOST ASKED QUESTIONS" },
    { id: "bending", title: "BENDING" },
    { id: "edge-quality", title: "EDGE QUALITY" },
    { id: "file-setup", title: "FILE SETUP" },
    { id: "materials", title: "MATERIALS" },
    { id: "orders", title: "ORDERS" },
    { id: "powder-coating", title: "POWDER COATING" },
    { id: "pricing-billing", title: "PRICING/BILLING" },
    { id: "production-times", title: "PRODUCTION TIMES" },
    { id: "surface-finishes", title: "SURFACE FINISHES" },
    { id: "shipping", title: "SHIPPING" },
    { id: "tapping", title: "TAPPING" },
    { id: "tolerances-standards", title: "TOLERANCES & STANDARDS" },
    { id: "using-parts", title: "USING YOUR PARTS" }
];

export const faqData = [
    {
        id: 1,
        category: "recent",
        question: "Why can’t I add finishing to my part?",
        answer: "You won’t be able to add anodizing, plating, or powder coating to your part before checkout if your design doesn’t meet our requirements. Parts must have a hole at least .063″ wide for hanging, fall within our overall part size limits, and be made from a material that supports the desired service."
    },
    {
        id: 2,
        category: "recent",
        question: "How do I keep perpendicular corner flanges from colliding in my design?",
        answer: "To keep perpendicular flanges from clashing in a corner, use our Min Corner Relief Distance from Bend Line spec (pictured below). If the clearance between bend lines meets or exceeds that value for your chosen material thickness, you’re in the clear."
    },
    {
        id: 3,
        category: "recent",
        question: "What bending specifications does DMS Engineering use for each material?",
        answer: "Our bending specifications — including bend radius, K factor, flange length, bend angle limits, and more — are listed in our Material Catalog and Bending Calculator. Use them exactly as provided to ensure your parts form within tolerance."
    },
    {
        id: 4,
        category: "recent",
        question: "How can I suggest new material or service options?",
        answer: "You can suggest new materials, thicknesses, or services through our online suggestion forms. We review every submission, and while we can’t promise to add everything, the most-requested ideas have the best shot at making it into our catalog or service lineup."
    },
    {
        id: 5,
        category: "recent",
        question: "Can you provide Ra or surface roughness specifications for your materials?",
        answer: "We don’t provide Ra or surface roughness specs for our materials because finishes can vary by supplier and batch. If no finishing service is added, your parts will ship with the standard mill finish, which may include light scratches."
    },
    {
        id: 6,
        category: "recent",
        question: "Can I request a specific grain direction for my sheet metal parts?",
        answer: "No — we can’t guarantee a specific grain direction. Parts are cut for maximum material efficiency, so grain direction can vary. If grain direction matters, apply your desired finish after you receive your parts."
    },
    {
        id: 7,
        category: "recent",
        question: "Do you offer free fonts for download?",
        answer: "Yes! We offer free stencil and positive style font packages for your text-based designs. These are the same fonts used in our free laser cutting templates and work with your preferred CAD software."
    },
    {
        id: 8,
        category: "recent",
        question: "How do I prevent dense nodes or anchor points in my design file?",
        answer: "Export your design directly from your CAD software using settings that preserve smooth arcs instead of breaking them into line segments. Fewer nodes means smoother cut edges and better production quality."
    },
    {
        id: 9,
        category: "recent",
        question: "How do I fund orders with credit terms?",
        answer: "We offer Net 30 terms at DMS Engineering! To fund orders with terms and attach purchase orders, read the full FAQ for step-by-step instructions!"
    },
    {
        id: 10,
        category: "recent",
        question: "Does DMS Engineering have gauge tables for Autodesk Fusion?",
        answer: "Yes — we offer free Fusion 360 gauge tables with our bending specs built in. Import them to set the correct bend radius, K factor, and bend relief for each material thickness we bend."
    },
    {
        id: 11,
        category: "recent",
        question: "Why doesn’t bend radius always match material thickness?",
        answer: "Bend radius depends on more than just thickness — tooling, material tensile strength, and die width all play a role. Some thinner materials may even have a larger bend radius than thicker ones."
    },
    {
        id: 12,
        category: "recent",
        question: "What are DMS Engineering’s bending requirements?",
        answer: "Our bending service requirements are detailed in our Bending Guidelines. Use this checklist of bending considerations to review your designs before uploading part files!"
    },
    {
        id: 13,
        category: "recent",
        question: "How do I bend parts with odd flange shapes?",
        answer: "To bend a flange with an irregular shape, add a flat reference edge parallel to the bend line. You can either modify your design to create a straight edge or add break-off tabs that you’ll remove after receiving your part."
    },
    {
        id: 14,
        category: "recent",
        question: "How do I prevent bend deformation?",
        answer: "Prevent deformation by meeting the minimum flange length, keeping cut features away from the bend line, and adding bend reliefs where needed. These design adjustments give the tooling enough support to form a clean, accurate bend."
    },
    {
        id: 15,
        category: "recent",
        question: "What are DMS Engineering’s bend relief requirements?",
        answer: "Bend relief notches reduce stress and tearing where bends meet corners. For sheet metal, we recommend reliefs — especially on thicker materials."
    },
    {
        id: 16,
        category: "recent",
        question: "What are your channel bend requirements?",
        answer: "Our channel bend (also known as u-channel and c-channel) requirements depend on the material, stock thickness, and part design geometry. Read the full FAQ to learn our general and specific limits for these types of bends!"
    },
    {
        id: 17,
        category: "recent",
        question: "What are your window bend requirements?",
        answer: "Window bends have additional requirements since they’re enclosed. Read the full FAQ to learn about minimum sizing and other considerations for window and recessed bends."
    },
    {
        id: 18,
        category: "recent",
        question: "What are your joggle bend requirements?",
        answer: "Our requirements for joggle bends depend on the material and bend angles. Generally, the more acute the angle, the more space is required between bends. Learn our specific criteria in the full FAQ!"
    },
    {
        id: 19,
        category: "recent",
        question: "How to measure flange length?",
        answer: "Flange length is measured from the center of a bend to the nearest cut edge. Learn how to apply our minimum flange specs for successful parts and quick turnarounds!"
    },
    {
        id: 20,
        category: "recent",
        question: "How to order mirrored parts?",
        answer: "Mirrored parts are easy to order at DMS Engineering. Learn about operation and material considerations for part mirroring and how to order these types of parts by either using our Duplicate item button or uploading a separate file."
    },
    {
        id: 21,
        category: "recent",
        question: "How do you bend parts?",
        answer: "We bend sheet metal with a process known as air bending. This means our bend radii are set for each material thickness and we’re unable to offer large radiused flanges. compound bends, or custom bend radiuses upon request."
    },
    {
        id: 23,
        category: "recent",
        question: "How to use part preview tools?",
        answer: "You can access the part preview tools by clicking the preview image on any part in your account, or when getting instant pricing. Then, under the preview image of your part, select the Tools option. From there you can directly measure your part or access material specs."
    },
    {
        id: 24,
        category: "recent",
        question: "What are your tolerances?",
        answer: "Find tolerance specifications for each material thickness on each material page in our Material Catalog. We provide cutting, bending, and material thickness tolerances so you can plan accordingly!"
    },
    {
        id: 25,
        category: "most-asked",
        question: "How can I suggest new material or service options?",
        answer: "You can suggest new materials, thicknesses, or services through our online suggestion forms. We review every submission, and while we can’t promise to add everything, the most-requested ideas have the best shot at making it into our catalog or service lineup."
    },
    {
        id: 26,
        category: "most-asked",
        question: "How do I fund orders with credit terms?",
        answer: "We offer Net 30 terms at DMS Engineering! To fund orders with terms and attach purchase orders, read the full FAQ for step-by-step instructions!"
    },
    {
        id: 27,
        category: "most-asked",
        question: "Can I send you existing parts to process?",
        answer: "We’re unable to process existing parts that are sent to us, since we cut from in-stock materials and only provide post processing services like bending, tapping, and finishing for parts we have cut."
    },
    {
        id: 28,
        category: "most-asked",
        question: "Can you help with my design?",
        answer: "We provide multiple resources for design help, including our online Parts Builder, trusted Design Partners, file setup and export tutorials, material selection tips, file setup FAQs, and service design guidelines!"
    },
    {
        id: 29,
        category: "most-asked",
        question: "Does DMS Engineering make parts in house?",
        answer: "Team DMS Engineering manufactures all parts with their own equipment in two US facilities. This includes everything from DFM, cutting, post processing, and quality control before shipping parts."
    },
    {
        id: 30,
        category: "most-asked",
        question: "Can DMS Engineering provide partial depth cuts?",
        answer: "We provide partial depth cuts in CNC machined metal billet. For sheet and plate stock, we only provide 2D perpendicular full depth cutting."
    },
    {
        id: 31,
        category: "most-asked",
        question: "Can Formal Quotes be tax exempt?",
        answer: "Formal quotes can be tax exempt! Just make sure the person creating the formal quote has tax exempt status set up for their DMS Engineering account before they create the quote. Then when creating the formal quote, check the tax exempt box at the Address & Billing step."
    },
    {
        id: 32,
        category: "most-asked",
        question: "Why won’t my STEP or STP file upload?",
        answer: "If your STEP/STP format file is having trouble uploading to DMS Engineering’s website for a sheet metal or plate part, ensure your design meets our 3D file guidelines."
    },
    {
        id: 33,
        category: "most-asked",
        question: "Why is my Formal Quote expired?",
        answer: "Wondering why your Formal Quote is expired? Not to worry! All Formal Quotes expire if payment is not submitted within 30 days. Fortunately it’s easy to resubmit Formal Quotes. Read the complete FAQ to learn how!"
    },
    {
        id: 34,
        category: "most-asked",
        question: "Can you refund sales tax from my order?",
        answer: "For resellers and tax exempt organizations, we can refund tax charged on orders if needed. However it’s best to request tax exemption status for your account before placing an order."
    },
    {
        id: 35,
        category: "most-asked",
        question: "Why can’t I add a service to my part?",
        answer: "Can’t add a service like bending/forming, countersinking, tapping, hardware insertion, deburring, anodizing, plating, or powder coating to your part after uploading your file to our website and selecting a material? There are a number of reasons why this might be the case. View the full FAQ to learn more."
    },
    {
        id: 36,
        category: "most-asked",
        question: "Do you offer white label packaging or drop shipping?",
        answer: "We do not offer white label packaging or drop shipping at this time. Currently all parts ship in DMS Engineering branded packaging."
    },
    {
        id: 37,
        category: "most-asked",
        question: "Does DMS Engineering offer multiaxis CNC machining or milling?",
        answer: "We offer multiaxis CNC machining and milling for billet material at DMS Engineering. Our machining service can produce dimensional features including pockets, slots, holes, bosses, webs, and flanges of varying heights and thicknesses."
    },
    {
        id: 38,
        category: "most-asked",
        question: "Can you send photos of my parts in production?",
        answer: "We’re unable to send photos of parts in production upon request. This is because we strive for efficient processes with the quickest possible turnaround times. Learn more about order production and lead times on our processing page."
    },
    {
        id: 39,
        category: "most-asked",
        question: "Can you pass delivery instructions to shipping carriers?",
        answer: "We’re unable to pass delivery instructions along to shipping carriers for you. Instead we recommend contacting the carrier after your package has shipped to submit any special instructions directly."
    },
    {
        id: 40,
        category: "most-asked",
        question: "Can you send the scraps or dropouts from my parts?",
        answer: "We’re unable to send you the scraps or dropout pieces, also known as negative geometry, from parts you order. This is because all material is used during our production process in order to offer the best possible pricing and reduce waste."
    },
    {
        id: 41,
        category: "bending",
        question: "How do I keep perpendicular corner flanges from colliding in my design?",
        answer: "To keep perpendicular flanges from clashing in a corner, use our Min Corner Relief Distance from Bend Line spec (pictured below). If the clearance between bend lines meets or exceeds that value for your chosen material thickness, you’re in the clear."
    },
    {
        id: 42,
        category: "bending",
        question: "What bending specifications does DMS Engineering use for each material?",
        answer: "Our bending specifications — including bend radius, K factor, flange length, bend angle limits, and more — are listed in our Material Catalog and Bending Calculator. Use them exactly as provided to ensure your parts form within tolerance."
    },
    {
        id: 43,
        category: "bending",
        question: "Does DMS Engineering have gauge tables for Autodesk Fusion?",
        answer: "Yes — we offer free Fusion 360 gauge tables with our bending specs built in. Import them to set the correct bend radius, K factor, and bend relief for each material thickness we bend."
    },
    {
        id: 44,
        category: "bending",
        question: "Why doesn’t bend radius always match material thickness?",
        answer: "Bend radius depends on more than just thickness — tooling, material tensile strength, and die width all play a role. Some thinner materials may even have a larger bend radius than thicker ones."
    },
    {
        id: 45,
        category: "bending",
        question: "What are DMS Engineering’s bending requirements?",
        answer: "Our bending service requirements are detailed in our Bending Guidelines. Use this checklist of bending considerations to review your designs before uploading part files!"
    },
    {
        id: 46,
        category: "bending",
        question: "How do I bend parts with odd flange shapes?",
        answer: "To bend a flange with an irregular shape, add a flat reference edge parallel to the bend line. You can either modify your design to create a straight edge or add break-off tabs that you’ll remove after receiving your part."
    },
    {
        id: 47,
        category: "bending",
        question: "How do I prevent bend deformation?",
        answer: "Prevent deformation by meeting the minimum flange length, keeping cut features away from the bend line, and adding bend reliefs where needed. These design adjustments give the tooling enough support to form a clean, accurate bend."
    },
    {
        id: 48,
        category: "bending",
        question: "What are DMS Engineering’s bend relief requirements?",
        answer: "Bend relief notches reduce stress and tearing where bends meet corners. For sheet metal, we recommend reliefs — especially on thicker materials."
    },
    {
        id: 49,
        category: "bending",
        question: "What are your channel bend requirements?",
        answer: "Our channel bend (also known as u-channel and c-channel) requirements depend on the material, stock thickness, and part design geometry. Read the full FAQ to learn our general and specific limits for these types of bends!"
    },
    {
        id: 50,
        category: "bending",
        question: "What are your window bend requirements?",
        answer: "Window bends have additional requirements since they’re enclosed. Read the full FAQ to learn about minimum sizing and other considerations for window and recessed bends."
    },
    {
        id: 51,
        category: "bending",
        question: "What are your joggle bend requirements?",
        answer: "Our requirements for joggle bends depend on the material and bend angles. Generally, the more acute the angle, the more space is required between bends. Learn our specific criteria in the full FAQ!"
    },
    {
        id: 52,
        category: "bending",
        question: "How to measure flange length?",
        answer: "Flange length is measured from the center of a bend to the nearest cut edge. Learn how to apply our minimum flange specs for successful parts and quick turnarounds!"
    },
    {
        id: 53,
        category: "bending",
        question: "How to order mirrored parts?",
        answer: "Mirrored parts are easy to order at DMS Engineering. Learn about operation and material considerations for part mirroring and how to order these types of parts by either using our Duplicate item button or uploading a separate file."
    },
    {
        id: 54,
        category: "bending",
        question: "How do you bend parts?",
        answer: "We bend sheet metal with a process known as air bending. This means our bend radii are set for each material thickness and we’re unable to offer large radiused flanges. compound bends, or custom bend radiuses upon request."
    },
    {
        id: 56,
        category: "bending",
        question: "How to use part preview tools?",
        answer: "You can access the part preview tools by clicking the preview image on any part in your account, or when getting instant pricing. Then, under the preview image of your part, select the Tools option. From there you can directly measure your part or access material specs."
    },
    {
        id: 57,
        category: "edge-quality",
        question: "How do I prevent dense nodes or anchor points in my design file?",
        answer: "Export your design directly from your CAD software using settings that preserve smooth arcs instead of breaking them into line segments. Fewer nodes means smoother cut edges and better production quality."
    },
    {
        id: 58,
        category: "edge-quality",
        question: "Will my deburred parts have sharp edges?",
        answer: "Parts with our linear deburring service will have sharp edges. The surface will be smooth and “cleaned up” from laser cutting, but there will be no edge softening."
    },
    {
        id: 59,
        category: "edge-quality",
        question: "Can DMS Engineering chamfer or machine the edges of parts?",
        answer: "At DMS Engineering we can chamfer or machine the edges of parts that meet our guidelines for CNC machining. We only machine parts out of billet stock at this time."
    },
    {
        id: 60,
        category: "edge-quality",
        question: "Do you offer deburring?",
        answer: "We offer linear deburring for eligible laser cut parts. If your part qualifies for linear deburring, it will be automatically selected at checkout. You can deselect it if you prefer to not have your part deburred."
    },
    {
        id: 61,
        category: "edge-quality",
        question: "Do you offer tumbling?",
        answer: "We soften the edges of laser cut parts and remove burrs on small parts through a ceramic tumbling process. Please note, this is not a finishing process and does not guarantee a uniform finish on the individual parts."
    },
    {
        id: 62,
        category: "edge-quality",
        question: "Will my parts have burr and dross?",
        answer: "DMS Engineering’s laser cutting methods prevent major burr and dross buildup, but both imperfections are still unavoidable parts of the manufacturing process. Read through our material pages to see examples of dross and burr in different thicknesses."
    },
    {
        id: 63,
        category: "edge-quality",
        question: "What are tabs? How can they be removed?",
        answer: "We use tabs to keep your parts from falling out of the parent sheet during laser cutting or waterjet cutting. Remove tabs by sanding them off by hand, or using a metal file. Please note, we’re unable to provide custom tab or lead-in/out placement."
    },
    {
        id: 64,
        category: "edge-quality",
        question: "Does DMS Engineering offer beveling or 3D cutting?",
        answer: "We offer beveling and 3D cutting in billet stock with our CNC machining service. CNC machining is not available for laser cut sheet and plate."
    },
    {
        id: 65,
        category: "edge-quality",
        question: "Will my parts be tapered?",
        answer: "Yes, it is possible your parts thicker than 0.250” will have a slight taper from top to bottom. The thicker the material, the more it will be tapered. DMS Engineering’s state of the art laser cutting and waterjet cutting technology is able to reduce the amount of taper during the process, but it cannot be completely eliminated."
    },
    {
        id: 66,
        category: "file-setup",
        question: "Why can’t I add finishing to my part?",
        answer: "You won’t be able to add anodizing, plating, or powder coating to your part before checkout if your design doesn’t meet our requirements. Parts must have a hole at least .063″ wide for hanging, fall within our overall part size limits, and be made from a material that supports the desired service."
    },
    {
        id: 67,
        category: "file-setup",
        question: "How do I keep perpendicular corner flanges from colliding in my design?",
        answer: "To keep perpendicular flanges from clashing in a corner, use our Min Corner Relief Distance from Bend Line spec (pictured below). If the clearance between bend lines meets or exceeds that value for your chosen material thickness, you’re in the clear."
    },
    {
        id: 68,
        category: "file-setup",
        question: "What bending specifications does DMS Engineering use for each material?",
        answer: "Our bending specifications — including bend radius, K factor, flange length, bend angle limits, and more — are listed in our Material Catalog and Bending Calculator. Use them exactly as provided to ensure your parts form within tolerance."
    },
    {
        id: 69,
        category: "file-setup",
        question: "Do you offer free fonts for download?",
        answer: "Yes! We offer free stencil and positive style font packages for your text-based designs. These are the same fonts used in our free laser cutting templates and work with your preferred CAD software."
    },
    {
        id: 70,
        category: "file-setup",
        question: "How do I prevent dense nodes or anchor points in my design file?",
        answer: "Export your design directly from your CAD software using settings that preserve smooth arcs instead of breaking them into line segments. Fewer nodes means smoother cut edges and better production quality."
    },
    {
        id: 71,
        category: "file-setup",
        question: "Does DMS Engineering have gauge tables for Autodesk Fusion?",
        answer: "Yes — we offer free Fusion 360 gauge tables with our bending specs built in. Import them to set the correct bend radius, K factor, and bend relief for each material thickness we bend."
    },
    {
        id: 72,
        category: "file-setup",
        question: "What are DMS Engineering’s bending requirements?",
        answer: "Our bending service requirements are detailed in our Bending Guidelines. Use this checklist of bending considerations to review your designs before uploading part files!"
    },
    {
        id: 73,
        category: "file-setup",
        question: "How do I prevent bend deformation?",
        answer: "Prevent deformation by meeting the minimum flange length, keeping cut features away from the bend line, and adding bend reliefs where needed. These design adjustments give the tooling enough support to form a clean, accurate bend."
    },
    {
        id: 74,
        category: "file-setup",
        question: "What are DMS Engineering’s bend relief requirements?",
        answer: "Bend relief notches reduce stress and tearing where bends meet corners. For sheet metal, we recommend reliefs — especially on thicker materials."
    },
    {
        id: 75,
        category: "file-setup",
        question: "What are your channel bend requirements?",
        answer: "Our channel bend (also known as u-channel and c-channel) requirements depend on the material, stock thickness, and part design geometry. Read the full FAQ to learn our general and specific limits for these types of bends!"
    },
    {
        id: 76,
        category: "file-setup",
        question: "What are your joggle bend requirements?",
        answer: "Our requirements for joggle bends depend on the material and bend angles. Generally, the more acute the angle, the more space is required between bends. Learn our specific criteria in the full FAQ!"
    },
    {
        id: 77,
        category: "file-setup",
        question: "How to measure flange length?",
        answer: "Flange length is measured from the center of a bend to the nearest cut edge. Learn how to apply our minimum flange specs for successful parts and quick turnarounds!"
    },
    {
        id: 78,
        category: "file-setup",
        question: "How to order mirrored parts?",
        answer: "Mirrored parts are easy to order at DMS Engineering. Learn about operation and material considerations for part mirroring and how to order these types of parts by either using our Duplicate item button or uploading a separate file."
    },
    {
        id: 80,
        category: "file-setup",
        question: "How to use part preview tools?",
        answer: "You can access the part preview tools by clicking the preview image on any part in your account, or when getting instant pricing. Then, under the preview image of your part, select the Tools option. From there you can directly measure your part or access material specs."
    },
    {
        id: 81,
        category: "file-setup",
        question: "What are your tolerances?",
        answer: "Find tolerance specifications for each material thickness on each material page in our Material Catalog. We provide cutting, bending, and material thickness tolerances so you can plan accordingly!"
    },
    {
        id: 82,
        category: "materials",
        question: "What bending specifications does DMS Engineering use for each material?",
        answer: "Our bending specifications — including bend radius, K factor, flange length, bend angle limits, and more — are listed in our Material Catalog and Bending Calculator. Use them exactly as provided to ensure your parts form within tolerance."
    },
    {
        id: 83,
        category: "materials",
        question: "How can I suggest new material or service options?",
        answer: "You can suggest new materials, thicknesses, or services through our online suggestion forms. We review every submission, and while we can’t promise to add everything, the most-requested ideas have the best shot at making it into our catalog or service lineup."
    },
    {
        id: 84,
        category: "materials",
        question: "Why doesn’t bend radius always match material thickness?",
        answer: "Bend radius depends on more than just thickness — tooling, material tensile strength, and die width all play a role. Some thinner materials may even have a larger bend radius than thicker ones."
    },
    {
        id: 85,
        category: "materials",
        question: "What are your tolerances?",
        answer: "Find tolerance specifications for each material thickness on each material page in our Material Catalog. We provide cutting, bending, and material thickness tolerances so you can plan accordingly!"
    },
    {
        id: 86,
        category: "materials",
        question: "Can I send you existing parts to process?",
        answer: "We’re unable to process existing parts that are sent to us, since we cut from in-stock materials and only provide post processing services like bending, tapping, and finishing for parts we have cut."
    },
    {
        id: 87,
        category: "materials",
        question: "Why can’t I select a material after uploading a file?",
        answer: "This typically occurs because the overall flat part size is too large or too small for the material. Please check that the file is setup at 1:1 scale in inch or millimeter units. Ensure the correct unit is set for your part after uploading the file."
    },
    {
        id: 88,
        category: "materials",
        question: "What metal colors do you offer?",
        answer: "At DMS Engineering we stock over 15 different sheet metal types in a wide range of natural unfinished hues. Additionally, we offer anodizing, plating, and powder coating services that can provide red, yellow, gold, green, blue, white, and black surface finishes."
    },
    {
        id: 89,
        category: "materials",
        question: "Does DMS Engineering cut tubing or piping?",
        answer: "We do not cut tubing or piping. We only cut in-stock materials which include sheet, plate, and billet options. Take a look at our Materials Catalog and Services page to learn more!"
    },
    {
        id: 90,
        category: "materials",
        question: "Can DMS Engineering use a different cutting method for my parts?",
        answer: "We choose the best cutting method for each material, so we aren’t able to use a different cut process upon request for individual orders. You can find the process by material on our design guidelines pages."
    },
    {
        id: 91,
        category: "materials",
        question: "Which metals are magnetic or conductive?",
        answer: "We make it easy for you to confirm material properties from our Materials Library. Each material has a detailed chart that includes specifications and properties."
    },
    {
        id: 92,
        category: "materials",
        question: "How thick can you cut?",
        answer: "If you need to know how thick we can cut at DMS Engineering, the best way to confirm this is by visiting our Material Minimum and Maximum Sizes chart. There you can find every stock thickness of material we offer and confirm the cutting process (fiber laser, waterjet, or CNC mill)."
    },
    {
        id: 93,
        category: "orders",
        question: "How do I fund orders with credit terms?",
        answer: "We offer Net 30 terms at DMS Engineering! To fund orders with terms and attach purchase orders, read the full FAQ for step-by-step instructions!"
    },
    {
        id: 94,
        category: "orders",
        question: "How to set up a business account for my company?",
        answer: "We refer to our business accounts as ‘Organizations’, which enable employees to benefit from their company’s tax exempt status, credit terms, and more. To set one up for your company, email support@DMS Engineering.com and request to set up an Organization."
    },
    {
        id: 95,
        category: "orders",
        question: "How to join my company’s Organization?",
        answer: "To join your company’s Organization, you can either choose to join as soon as you set up a DMS Engineering account using your work email address, accept an invitation from a coworker who is already part of your company’s Organization, or contact our Support team and request to be added."
    },
    {
        id: 96,
        category: "orders",
        question: "How to make changes to parts in my shopping cart?",
        answer: "On the instant-quoted line item in your shopping cart, simply click on the material or any services to make changes. This functionality is handy for quick updates before checkout and adjustments to parts you want to reorder. Please note, this is not available for custom quoted parts."
    },
    {
        id: 97,
        category: "orders",
        question: "Why is my Formal Quote expired?",
        answer: "Wondering why your Formal Quote is expired? Not to worry! All Formal Quotes expire if payment is not submitted within 30 days. Fortunately it’s easy to resubmit Formal Quotes. Read the complete FAQ to learn how!"
    },
    {
        id: 98,
        category: "orders",
        question: "Can you refund sales tax from my order?",
        answer: "For resellers and tax exempt organizations, we can refund tax charged on orders if needed. However it’s best to request tax exemption status for your account before placing an order."
    },
    {
        id: 99,
        category: "orders",
        question: "Can you send photos of my parts in production?",
        answer: "We’re unable to send photos of parts in production upon request. This is because we strive for efficient processes with the quickest possible turnaround times. Learn more about order production and lead times on our processing page."
    },
    {
        id: 100,
        category: "orders",
        question: "How to get a PDF quote?",
        answer: "If you need to get a PDF quote to send to your company’s purchasing department, our Formal Quote payment method makes it easy. Please note, when you create a Formal Quote, the parts will not move into production until payment is submitted."
    },
    {
        id: 101,
        category: "orders",
        question: "How to get a custom quote from DMS Engineering?",
        answer: "If you upload your part file to our website and the overall part size exceeds the maximum size for instant quoting in that material, you’ll be prompted to submit a custom quote."
    },
    {
        id: 102,
        category: "orders",
        question: "How to change the email address for my order?",
        answer: "If you want to change the email address for an order, you’ll need to change the contact email for your DMS Engineering account. The contact email address associated with your account will receive all communication about orders."
    },
    {
        id: 103,
        category: "orders",
        question: "What is my DMS Engineering order status?",
        answer: "You can check the status of any order by logging into your DMS Engineering account, navigating to the Orders page, and clicking the Track Order link on the order."
    },
    {
        id: 104,
        category: "orders",
        question: "Can I send you a PDF?",
        answer: "PDFs can’t be uploaded for instant quoting or emailed to DMS Engineering to create or configure orders. However our trusted Design Partners can help with converting PDFs to CAD files if your PDF if needed."
    },
    {
        id: 105,
        category: "orders",
        question: "Can I pay for my parts using a purchase order?",
        answer: "You may attach a PO to your order before checkout, but all order information must be added to your order through the cart-building process. We do not check Purchase Orders for additional services or details that are not included in your cart."
    },
    {
        id: 106,
        category: "orders",
        question: "How do I get a Formal Quote from DMS Engineering?",
        answer: "Formal Quotes make it easy to send a link to your accounts payable department so they can process payment for orders online, while the order itself remains associated with your account. This allows you to remain the point of contact if there are any questions during production. Read the complete FAQ for detailed info!"
    },
    {
        id: 107,
        category: "orders",
        question: "How to reorder parts?",
        answer: "Create a free DMS Engineering account and you can easily reorder instant-quoted parts anytime. Just log into your account, navigate to the Orders tab, find the order, and click Reorder."
    },
    {
        id: 108,
        category: "orders",
        question: "How do I find order invoices and packing slips?",
        answer: "You can find the invoice for any order by logging into your DMS Engineering account and navigating to the Orders tab. Then find your order and click Invoice to view it or print a PDF if needed."
    },
    {
        id: 109,
        category: "powder-coating",
        question: "Why can’t I add finishing to my part?",
        answer: "You won’t be able to add anodizing, plating, or powder coating to your part before checkout if your design doesn’t meet our requirements. Parts must have a hole at least .063″ wide for hanging, fall within our overall part size limits, and be made from a material that supports the desired service."
    },
    {
        id: 110,
        category: "powder-coating",
        question: "Why can’t I add a service to my part?",
        answer: "Can’t add a service like bending/forming, countersinking, tapping, hardware insertion, deburring, anodizing, plating, or powder coating to your part after uploading your file to our website and selecting a material? There are a number of reasons why this might be the case. View the full FAQ to learn more."
    },
    {
        id: 111,
        category: "powder-coating",
        question: "What metal colors do you offer?",
        answer: "At DMS Engineering we stock over 15 different sheet metal types in a wide range of natural unfinished hues. Additionally, we offer anodizing, plating, and powder coating services that can provide red, yellow, gold, green, blue, white, and black surface finishes."
    },
    {
        id: 112,
        category: "powder-coating",
        question: "Is your powder coating fingerprint resistant?",
        answer: "Our wrinkle black powder coating is fingerprint resistant. All other colors will show fingerprints. These are easily removed by using a soft cloth with mild soap and water."
    },
    {
        id: 113,
        category: "powder-coating",
        question: "Will other services be performed before or after finishing?",
        answer: "Bending, countersinking, and tapping services are performed before finishing services. Hardware is installed after anodizing and plating, but before powder coating. Parts with both hardware and powder coating services will have the hardware capped/plugged before being powder coated."
    },
    {
        id: 114,
        category: "powder-coating",
        question: "Can you apply finishing services to specific areas of my part?",
        answer: "If you choose to add a finishing service (anodizing, plating, or powder coating) to parts, we will apply the finish to the entire part. We’re unable to provide masking or finish specific areas or portions of parts, and not other areas."
    },
    {
        id: 115,
        category: "powder-coating",
        question: "What are the thicknesses for your finishes?",
        answer: "Our finishing services can add ~0.0004”-0.01″ to the overall thickness of your parts depending on the finish type (anodizing, plating, or powder coating). See the FAQ or service guidelines for details."
    },
    {
        id: 116,
        category: "powder-coating",
        question: "What materials are available for powder coating?",
        answer: "Aluminum, mild steel and stainless steel are the best candidates for powder coating. To confirm which materials and thicknesses are eligible for powder coating, take a look at our powder coating guidelines page."
    },
    {
        id: 117,
        category: "powder-coating",
        question: "What is the production time for powder coating?",
        answer: "Powder coating adds 3-5 days to an order’s lead time before shipping. For this reason, we recommend ordering finished and unfinished parts separately so we can ship your non-powder coated parts as soon as they’re ready."
    },
    {
        id: 118,
        category: "powder-coating",
        question: "What should I expect when I get a part powder coated?",
        answer: "Powder coating adds 7-10 days to an order’s lead time. Check out the complete FAQ and our powder coating guidelines for all details, tips, and considerations!"
    },
    {
        id: 119,
        category: "powder-coating",
        question: "Can I powder coat my bent or tapped part?",
        answer: "You can powder coat bent/formed and tapped parts. Please be aware that die witness marks from the press brake will be visible through the coating. Also, you will have to chase any tapped holes to clear the threads once you receive the parts."
    },
    {
        id: 120,
        category: "powder-coating",
        question: "What colors are available for powder coating?",
        answer: "We offer powder coating in seven colors: matte black, gloss black, wrinkle black, gloss white, gloss red, gloss yellow, and emerald green."
    },
    {
        id: 121,
        category: "powder-coating",
        question: "Do you offer powder coating?",
        answer: "Yes! In addition to cutting, deburring, and bending, we offer powder coating via our Instant Quote process. For details, check out our powder coating page."
    },
    {
        id: 122,
        category: "pricing-billing",
        question: "How do I fund orders with credit terms?",
        answer: "We offer Net 30 terms at DMS Engineering! To fund orders with terms and attach purchase orders, read the full FAQ for step-by-step instructions!"
    },
    {
        id: 123,
        category: "pricing-billing",
        question: "How to set up a business account for my company?",
        answer: "We refer to our business accounts as ‘Organizations’, which enable employees to benefit from their company’s tax exempt status, credit terms, and more. To set one up for your company, email support@DMS Engineering.com and request to set up an Organization."
    },
    {
        id: 124,
        category: "pricing-billing",
        question: "How to join my company’s Organization?",
        answer: "To join your company’s Organization, you can either choose to join as soon as you set up a DMS Engineering account using your work email address, accept an invitation from a coworker who is already part of your company’s Organization, or contact our Support team and request to be added."
    },
    {
        id: 125,
        category: "pricing-billing",
        question: "Can Formal Quotes be tax exempt?",
        answer: "Formal quotes can be tax exempt! Just make sure the person creating the formal quote has tax exempt status set up for their DMS Engineering account before they create the quote. Then when creating the formal quote, check the tax exempt box at the Address & Billing step."
    },
    {
        id: 126,
        category: "pricing-billing",
        question: "Why is my Formal Quote expired?",
        answer: "Wondering why your Formal Quote is expired? Not to worry! All Formal Quotes expire if payment is not submitted within 30 days. Fortunately it’s easy to resubmit Formal Quotes. Read the complete FAQ to learn how!"
    },
    {
        id: 127,
        category: "pricing-billing",
        question: "Can you refund sales tax from my order?",
        answer: "For resellers and tax exempt organizations, we can refund tax charged on orders if needed. However it’s best to request tax exemption status for your account before placing an order."
    },
    {
        id: 128,
        category: "pricing-billing",
        question: "How to get a discount on your DMS Engineering order?",
        answer: "DMS Engineering offers automatic quantity discounts when you instantly price most parts, plus occasional promo codes through our mailing list. You’ll save more by ordering multiple identical parts, and you can apply discount codes at checkout if you have one."
    },
    {
        id: 129,
        category: "pricing-billing",
        question: "How to get a PDF quote?",
        answer: "If you need to get a PDF quote to send to your company’s purchasing department, our Formal Quote payment method makes it easy. Please note, when you create a Formal Quote, the parts will not move into production until payment is submitted."
    },
    {
        id: 130,
        category: "pricing-billing",
        question: "Can I pay for my parts using a purchase order?",
        answer: "You may attach a PO to your order before checkout, but all order information must be added to your order through the cart-building process. We do not check Purchase Orders for additional services or details that are not included in your cart."
    },
    {
        id: 131,
        category: "pricing-billing",
        question: "How do I get a Formal Quote from DMS Engineering?",
        answer: "Formal Quotes make it easy to send a link to your accounts payable department so they can process payment for orders online, while the order itself remains associated with your account. This allows you to remain the point of contact if there are any questions during production. Read the complete FAQ for detailed info!"
    },
    {
        id: 132,
        category: "pricing-billing",
        question: "Can my orders be tax exempt?",
        answer: "If your organization is tax exempt, send your valid tax exemption certificate to DMS Engineering’s support team. We’ll review your certificate and then respond with an update! Please be sure to set up an account before requesting exemption."
    },
    {
        id: 133,
        category: "pricing-billing",
        question: "How do I save money on my project?",
        answer: "You can reduce the number of holes or “pierces”, eliminate duplicate lines and unnecessary geometry, keep designs no larger than the max instant quote size, use thinner materials, and increase your parts per line item for quantity discounts. Join our mailing list as well for access to limited-time promotions!"
    },
    {
        id: 134,
        category: "pricing-billing",
        question: "Do you offer refunds or remakes?",
        answer: "If you’re not satisfied with your order, we’re happy to help! Contact our Support team and provide photos of the parts you received. We’ll work with you to find the best solution."
    },
    {
        id: 135,
        category: "pricing-billing",
        question: "How can I get help with my order?",
        answer: "Our Customer Support and Applications Engineering teams are available on weekdays to assist you with any questions or concerns. Reach out and we’ll get back to you within 4 business hours."
    },
    {
        id: 136,
        category: "pricing-billing",
        question: "How do you calculate pricing for laser cutting?",
        answer: "We calculate over two dozen factors to give you the most accurate price possible, including material, stock thickness, weight, quantity, and the overall design. Visit our pricing page for complete details!"
    },
    {
        id: 137,
        category: "pricing-billing",
        question: "Do you offer wholesale pricing?",
        answer: "Yes, we’re here to support businesses of all sizes! We’re happy to offer discounted pricing for large quantities and frequent orders. Please contact our Support team for assistance."
    },
    {
        id: 138,
        category: "production-times",
        question: "Can you send photos of my parts in production?",
        answer: "We’re unable to send photos of parts in production upon request. This is because we strive for efficient processes with the quickest possible turnaround times. Learn more about order production and lead times on our processing page."
    },
    {
        id: 139,
        category: "production-times",
        question: "What is my DMS Engineering order status?",
        answer: "You can check the status of any order by logging into your DMS Engineering account, navigating to the Orders page, and clicking the Track Order link on the order."
    },
    {
        id: 140,
        category: "production-times",
        question: "What is the production time for powder coating?",
        answer: "Powder coating adds 3-5 days to an order’s lead time before shipping. For this reason, we recommend ordering finished and unfinished parts separately so we can ship your non-powder coated parts as soon as they’re ready."
    },
    {
        id: 141,
        category: "production-times",
        question: "What should I expect when I get a part powder coated?",
        answer: "Powder coating adds 7-10 days to an order’s lead time. Check out the complete FAQ and our powder coating guidelines for all details, tips, and considerations!"
    },
    {
        id: 142,
        category: "production-times",
        question: "What are your standard production times?",
        answer: "Your estimated ship date is calculated in real-time in your shopping cart as you add parts and services. Production times for standard orders without additional services like bending or finishing are typically 2-4 business days before shipping."
    },
    {
        id: 143,
        category: "production-times",
        question: "Can I rush my order?",
        answer: "We treat every order as a rush order and do our best to ship parts as quickly as possible! For this reason we aren’t able to offer expedited production for all orders and operations."
    },
    {
        id: 144,
        category: "production-times",
        question: "Can I overnight my order?",
        answer: "If your order qualifies, you will see the option to add Overnight Shipping to your order at checkout. This option will not be available for parts shipped outside the US. The express shipping fee will depend on the size and weight of your order."
    },
    {
        id: 145,
        category: "production-times",
        question: "What could potentially slow down my order?",
        answer: "Your order could be slowed down if there are special requests, if your files do not meet our design guidelines and require revision, or if your order includes post processing services that add lead time."
    },
    {
        id: 146,
        category: "production-times",
        question: "I need my parts NOW! How quickly can I get them?",
        answer: "We’re unable to speed up production of parts that are already being processed. However, overnight shipping is available for qualifying orders that will be delivered within the US."
    },
    {
        id: 147,
        category: "production-times",
        question: "How quickly will I receive my parts?",
        answer: "How quickly you receive your parts will depend on the services added to your order and overall part volume. The estimated ship date for your order is calculated in real-time in your shopping cart as you add parts and services. Then, the estimated ship date is confirmed when you check out."
    },
    {
        id: 148,
        category: "production-times",
        question: "When will my order ship?",
        answer: "Your estimated ship date is calculated in real-time in your shopping cart as you add parts and services. Then, your estimated ship date is confirmed when you check out. You can also find the estimated ship date and follow your order’s production status through the tracking link we’ll email you."
    },
    {
        id: 149,
        category: "surface-finishes",
        question: "Why can’t I add finishing to my part?",
        answer: "You won’t be able to add anodizing, plating, or powder coating to your part before checkout if your design doesn’t meet our requirements. Parts must have a hole at least .063″ wide for hanging, fall within our overall part size limits, and be made from a material that supports the desired service."
    },
    {
        id: 150,
        category: "surface-finishes",
        question: "Can you provide Ra or surface roughness specifications for your materials?",
        answer: "We don’t provide Ra or surface roughness specs for our materials because finishes can vary by supplier and batch. If no finishing service is added, your parts will ship with the standard mill finish, which may include light scratches."
    },
    {
        id: 151,
        category: "surface-finishes",
        question: "Can I request a specific grain direction for my sheet metal parts?",
        answer: "No — we can’t guarantee a specific grain direction. Parts are cut for maximum material efficiency, so grain direction can vary. If grain direction matters, apply your desired finish after you receive your parts."
    },
    {
        id: 152,
        category: "surface-finishes",
        question: "Do you offer plating services?",
        answer: "We do offer plating services for sheet metal parts! Take a look at our Plating Guidelines to learn about the part and material requirements for our plating services. Once your design is ready, upload your file to our website, select an eligible material, and add electroplating to your parts before checkout!"
    },
    {
        id: 153,
        category: "surface-finishes",
        question: "Will my deburred parts have sharp edges?",
        answer: "Parts with our linear deburring service will have sharp edges. The surface will be smooth and “cleaned up” from laser cutting, but there will be no edge softening."
    },
    {
        id: 154,
        category: "surface-finishes",
        question: "What metal colors do you offer?",
        answer: "At DMS Engineering we stock over 15 different sheet metal types in a wide range of natural unfinished hues. Additionally, we offer anodizing, plating, and powder coating services that can provide red, yellow, gold, green, blue, white, and black surface finishes."
    },
    {
        id: 155,
        category: "surface-finishes",
        question: "Which materials are available for anodizing?",
        answer: "At this time we anodize 5052, 6061, and 7075 aluminum. Many non-ferrous metal materials can be anodized, but aluminum is the best candidate and creates the most successful finish."
    },
    {
        id: 156,
        category: "surface-finishes",
        question: "Is your powder coating fingerprint resistant?",
        answer: "Our wrinkle black powder coating is fingerprint resistant. All other colors will show fingerprints. These are easily removed by using a soft cloth with mild soap and water."
    },
    {
        id: 157,
        category: "surface-finishes",
        question: "Will other services be performed before or after finishing?",
        answer: "Bending, countersinking, and tapping services are performed before finishing services. Hardware is installed after anodizing and plating, but before powder coating. Parts with both hardware and powder coating services will have the hardware capped/plugged before being powder coated."
    },
    {
        id: 158,
        category: "surface-finishes",
        question: "Can you apply finishing services to specific areas of my part?",
        answer: "If you choose to add a finishing service (anodizing, plating, or powder coating) to parts, we will apply the finish to the entire part. We’re unable to provide masking or finish specific areas or portions of parts, and not other areas."
    },
    {
        id: 159,
        category: "surface-finishes",
        question: "Will nickel plating hold up to polishing or sanding?",
        answer: "Our nickel plating is quite thin (adding approximately ~0.0002″ per side), so you will need to be careful to avoid wearing through the finish. A small amount of light polishing may be doable but any more aggressive treatment like sanding could penetrate through to the underlying material."
    },
    {
        id: 160,
        category: "surface-finishes",
        question: "How to prep metal parts for painting or welding?",
        answer: "If you plan to paint or weld your metal parts after you receive them, you can use acetone to clean them up beforehand and remove all oils."
    },
    {
        id: 161,
        category: "surface-finishes",
        question: "What are the thicknesses for your finishes?",
        answer: "Our finishing services can add ~0.0004”-0.01″ to the overall thickness of your parts depending on the finish type (anodizing, plating, or powder coating). See the FAQ or service guidelines for details."
    },
    {
        id: 162,
        category: "surface-finishes",
        question: "What is the smallest/largest part I can have deburred?",
        answer: "Linear deburring is available for parts as small as 1″ x 3″ and as large as 24″ x 46″ depending on the design, material, and geometry."
    },
    {
        id: 163,
        category: "surface-finishes",
        question: "Why can’t I select deburring for my part?",
        answer: "If deburring is not an option before checkout, it’s typically because the material and/or stock thickness is not eligible or the overall flat part size is too small or too large. Please see our deburring page to confirm requirements for the service."
    },
    {
        id: 164,
        category: "surface-finishes",
        question: "Do you offer deburring?",
        answer: "We offer linear deburring for eligible laser cut parts. If your part qualifies for linear deburring, it will be automatically selected at checkout. You can deselect it if you prefer to not have your part deburred."
    },
    {
        id: 165,
        category: "shipping",
        question: "How to change the shipping address for my account?",
        answer: "You can update the shipping addresses for your account under account Settings. It’s also possible to update your shipping address at the Billing & Shipping step of checkout."
    },
    {
        id: 166,
        category: "shipping",
        question: "Do you offer white label packaging or drop shipping?",
        answer: "We do not offer white label packaging or drop shipping at this time. Currently all parts ship in DMS Engineering branded packaging."
    },
    {
        id: 167,
        category: "shipping",
        question: "Can you pass delivery instructions to shipping carriers?",
        answer: "We’re unable to pass delivery instructions along to shipping carriers for you. Instead we recommend contacting the carrier after your package has shipped to submit any special instructions directly."
    },
    {
        id: 168,
        category: "shipping",
        question: "What is my DMS Engineering order status?",
        answer: "You can check the status of any order by logging into your DMS Engineering account, navigating to the Orders page, and clicking the Track Order link on the order."
    },
    {
        id: 169,
        category: "shipping",
        question: "Can you cut material I ship to you?",
        answer: "Due to safety and procedural risks, DMS Engineering does not cut or process raw material that is shipped to us from customers. Additionally, we cannot accept raw material or components from vendors such as McMaster-Carr per request for specific customers or projects."
    },
    {
        id: 170,
        category: "shipping",
        question: "Can you ship to my PO Box, APO, or FPO address?",
        answer: "We do not ship to PO boxes, APO, or FPO addresses at this time. Please provide us with a physical address. Read our shipping information page and policies for more information about our shipping process, if your order qualifies for free shipping, and factors that may affect your order processing times."
    },
    {
        id: 171,
        category: "shipping",
        question: "How can I track my package?",
        answer: "Package tracking is automatic with DMS Engineering! Once your order has been placed and processed, you will receive tracking information via email or mobile device when a tracking number has been created."
    },
    {
        id: 172,
        category: "shipping",
        question: "How can I get help with my order?",
        answer: "Our Customer Support and Applications Engineering teams are available on weekdays to assist you with any questions or concerns. Reach out and we’ll get back to you within 4 business hours."
    },
    {
        id: 173,
        category: "shipping",
        question: "What are DMS Engineering’s shipping pickup times, deadlines, and guidelines on address changes?",
        answer: "Our carriers pick up orders multiple times a day on weekdays. Although we package parts and create labels 7 days a week, shipments aren’t picked up on Sundays or after 4pm local time Mondays-Saturdays. Once a label is created, we cannot make address changes or convert the order to local pickup."
    },
    {
        id: 174,
        category: "shipping",
        question: "Can I rush my order?",
        answer: "We treat every order as a rush order and do our best to ship parts as quickly as possible! For this reason we aren’t able to offer expedited production for all orders and operations."
    },
    {
        id: 175,
        category: "shipping",
        question: "Can I overnight my order?",
        answer: "If your order qualifies, you will see the option to add Overnight Shipping to your order at checkout. This option will not be available for parts shipped outside the US. The express shipping fee will depend on the size and weight of your order."
    },
    {
        id: 176,
        category: "shipping",
        question: "I need my parts NOW! How quickly can I get them?",
        answer: "We’re unable to speed up production of parts that are already being processed. However, overnight shipping is available for qualifying orders that will be delivered within the US."
    },
    {
        id: 177,
        category: "shipping",
        question: "Can you use my shipping account or preferred carrier?",
        answer: "We cannot use 3rd party accounts or carriers due to our highly automated shipping system. With that in mind, you can trust we will ship your parts as quickly and efficiently as possible."
    },
    {
        id: 178,
        category: "shipping",
        question: "How quickly will I receive my parts?",
        answer: "How quickly you receive your parts will depend on the services added to your order and overall part volume. The estimated ship date for your order is calculated in real-time in your shopping cart as you add parts and services. Then, the estimated ship date is confirmed when you check out."
    },
    {
        id: 179,
        category: "shipping",
        question: "Do you offer local pickup?",
        answer: "Local pickup is available to qualifying orders that exceed 20 lbs. Contact our Support team to confirm if your parts are eligible for pickup at the DMS Engineering manufacturing facility closest to you."
    },
    {
        id: 180,
        category: "shipping",
        question: "Can you ship to countries outside of the US?",
        answer: "We ship to Canada and all 50 states in the USA. At this time, we do not ship to any other countries besides the US and Canada."
    },
    {
        id: 181,
        category: "tapping",
        question: "Can DMS Engineering provide partial depth cuts?",
        answer: "We provide partial depth cuts in CNC machined metal billet. For sheet and plate stock, we only provide 2D perpendicular full depth cutting."
    },
    {
        id: 182,
        category: "tapping",
        question: "Can DMS Engineering drill holes into the side of my parts?",
        answer: "Our tapping, countersinking, and hardware insertion services can be added to the top or bottom face of sheet and plate material. We don’t offer drilling into the cut edge of sheet stock. With billet, we can CNC machine holes into any side of a part."
    },
    {
        id: 183,
        category: "tapping",
        question: "Why can’t I add a service to my part?",
        answer: "Can’t add a service like bending/forming, countersinking, tapping, hardware insertion, deburring, anodizing, plating, or powder coating to your part after uploading your file to our website and selecting a material? There are a number of reasons why this might be the case. View the full FAQ to learn more."
    },
    {
        id: 184,
        category: "tapping",
        question: "Which tap sizes can I use for my project?",
        answer: "All tap sizes we offer are listed in the tap size chart on our tapping guidelines page. To confirm available tap sizes for the material thickness you need, check the material details and specifications in our Material Catalog."
    },
    {
        id: 185,
        category: "tapping",
        question: "Do you offer counterboring?",
        answer: "DMS Engineering does not offer counterboring at this time. We do provide countersinking, PEM hardware insertion, and tapping for eligible sheet metals."
    },
    {
        id: 186,
        category: "tapping",
        question: "Can I request unavailable tap sizes?",
        answer: "If you want to request an unavailable tap size, first confirm whether we offer it in any material. You can see all of our tap sizes in our Thread/Tap Hole Size Chart. If we do offer the tap size but you’re unable to add it to a part you want to order, that is typically due to material thickness or geometry constraints."
    },
    {
        id: 187,
        category: "tapping",
        question: "Will other services be performed before or after finishing?",
        answer: "Bending, countersinking, and tapping services are performed before finishing services. Hardware is installed after anodizing and plating, but before powder coating. Parts with both hardware and powder coating services will have the hardware capped/plugged before being powder coated."
    },
    {
        id: 188,
        category: "tapping",
        question: "What is the ideal hole size and thread engagement for tapping?",
        answer: "Designing the correct hole size when preparing for tapping is important. Holes that are too large may cause the tap to strip out or fail. If the hole is too small, it will cause the tap to bind, create excessive heat, and could result in a broken tap trying to cut too much material."
    },
    {
        id: 189,
        category: "tapping",
        question: "What materials are available for tapping at DMS Engineering?",
        answer: "We currently have a variety of sheet metal materials available for tapping. You can quickly confirm which materials are available for tapping at our Processing Maximums and Minimums page."
    },
    {
        id: 190,
        category: "tapping",
        question: "Can I powder coat my bent or tapped part?",
        answer: "You can powder coat bent/formed and tapped parts. Please be aware that die witness marks from the press brake will be visible through the coating. Also, you will have to chase any tapped holes to clear the threads once you receive the parts."
    },
    {
        id: 191,
        category: "tapping",
        question: "How do I set up my file for tapping with DMS Engineering?",
        answer: "Setup for tapping depends on whether you plan to order sheet parts or machined billet parts. For sheet and plate parts, we accept both vector and 3D file formats and we’ll resize holes up to 4.00″ to fit the tap size you choose. For machined billet parts, we accept STEP/STP files. Don’t model threads in your file – design them as simple holes."
    },
    {
        id: 192,
        category: "tolerances-standards",
        question: "Can you provide Ra or surface roughness specifications for your materials?",
        answer: "We don’t provide Ra or surface roughness specs for our materials because finishes can vary by supplier and batch. If no finishing service is added, your parts will ship with the standard mill finish, which may include light scratches."
    },
    {
        id: 193,
        category: "tolerances-standards",
        question: "What are your tolerances?",
        answer: "Find tolerance specifications for each material thickness on each material page in our Material Catalog. We provide cutting, bending, and material thickness tolerances so you can plan accordingly!"
    },
    {
        id: 194,
        category: "tolerances-standards",
        question: "Can you send the scraps or dropouts from my parts?",
        answer: "We’re unable to send you the scraps or dropout pieces, also known as negative geometry, from parts you order. This is because all material is used during our production process in order to offer the best possible pricing and reduce waste."
    },
    {
        id: 195,
        category: "tolerances-standards",
        question: "Can DMS Engineering bend parts with a custom bend radius?",
        answer: "DMS Engineering does not provide a custom bend radius for any bent parts since it is set for each material and thickness. Take a look at the material page for your chosen material to find the bend radius by thickness, or check out the bending specifications table at the bottom of our Bending Calculator page."
    },
    {
        id: 196,
        category: "tolerances-standards",
        question: "Will my laser cut sheet metal parts be perfectly flat?",
        answer: "Our typical raw material flatness deviation is +/- 0.030” per foot in our laser cut sheet metals. Individual part flatness depends on the cut geometry and stress relief when material is removed during the cut process, so we’re not able to guarantee the flatness of finished parts."
    },
    {
        id: 197,
        category: "tolerances-standards",
        question: "What are the thicknesses for your finishes?",
        answer: "Our finishing services can add ~0.0004”-0.01″ to the overall thickness of your parts depending on the finish type (anodizing, plating, or powder coating). See the FAQ or service guidelines for details."
    },
    {
        id: 198,
        category: "tolerances-standards",
        question: "What are your tolerances for bending?",
        answer: "You can find tolerances for bending in the specifications on each material info page in our Material Catalog. Learn about tolerance stackup considerations in the full FAQ!"
    },
    {
        id: 199,
        category: "tolerances-standards",
        question: "What is your material thickness tolerance?",
        answer: "You can find the material thickness tolerance for each stock thickness on the material pages in our Material Catalog. Navigate to the material you need and then click Specifications. Select your desired thickness and check out its details and specifications! Material thickness tolerance specifications will be listed under the General Details. This tolerance represents the acceptable range of variation in the material's thickness."
    },
    {
        id: 200,
        category: "tolerances-standards",
        question: "How can I design a slip fit for mating parts?",
        answer: "Take a look at this FAQ for best practices! For specific, in-depth advice on designing tabs and slots to create a slip fit, check out our Designing Sheet Metal Parts with Tab and Slots guide."
    },
    {
        id: 201,
        category: "tolerances-standards",
        question: "What is your cut tolerance?",
        answer: "The cut tolerance for each material depends on the cutting process for that material and specific thickness. You can find cut tolerance specifications for each stock thickness on the material pages in our Material Catalog."
    },
    {
        id: 202,
        category: "tolerances-standards",
        question: "Will my parts from DMS Engineering be food safe?",
        answer: "DMS Engineering does not offer a food safe production process for any service."
    },
    {
        id: 203,
        category: "tolerances-standards",
        question: "Will my parts be tapered?",
        answer: "Yes, it is possible your parts thicker than 0.250” will have a slight taper from top to bottom. The thicker the material, the more it will be tapered. DMS Engineering’s state of the art laser cutting and waterjet cutting technology is able to reduce the amount of taper during the process, but it cannot be completely eliminated."
    },
    {
        id: 204,
        category: "tolerances-standards",
        question: "What are your etching limitations?",
        answer: "We have multiple etching limitations to keep in mind since we do not offer laser engraving or solid etching. Our etching services are currently limited to single line etching. Please note: single line etching is faint and shouldn’t be used for cosmetic applications."
    },
    {
        id: 205,
        category: "tolerances-standards",
        question: "What is the size of your laser kerf?",
        answer: "We compensate for all kerf and line offsets in your design. We change the beam position based on the geometry of the part, and we are able to hold +/- .005″ tolerance or better on most materials. We take care of everything so you don’t have to. Our fiber laser beam diameter varies between roughly 0.006″ and 0.010” depending on the material being cut, but you do not need to make any adjustments to your design to compensate for the kerf in the laser cutter."
    },
    {
        id: 206,
        category: "tolerances-standards",
        question: "What are the material specifications?",
        answer: "Material specifications are the limits and design requirements for each material thickness we offer, including tolerances, minimum cut sizes, flange lengths, bend limits, and more. You can find them on each material page in our Material Catalog."
    },
    {
        id: 207,
        category: "tolerances-standards",
        question: "Do I need to compensate for kerf in my design?",
        answer: "You don’t need to compensate for kerf in your design since we account for it on our end. However you should consider cut tolerance, material thickness tolerance, and bending tolerances. See the FAQ for more information on kerf and tolerances!"
    },
    {
        id: 208,
        category: "using-parts",
        question: "What are your tolerances?",
        answer: "Find tolerance specifications for each material thickness on each material page in our Material Catalog. We provide cutting, bending, and material thickness tolerances so you can plan accordingly!"
    },
    {
        id: 210,
        category: "using-parts",
        question: "Can DMS Engineering drill holes into the side of my parts?",
        answer: "Our tapping, countersinking, and hardware insertion services can be added to the top or bottom face of sheet and plate material. We don’t offer drilling into the cut edge of sheet stock. With billet, we can CNC machine holes into any side of a part."
    },
    {
        id: 211,
        category: "using-parts",
        question: "Can you send the scraps or dropouts from my parts?",
        answer: "We’re unable to send you the scraps or dropout pieces, also known as negative geometry, from parts you order. This is because all material is used during our production process in order to offer the best possible pricing and reduce waste."
    },
    {
        id: 212,
        category: "using-parts",
        question: "Which metals are magnetic or conductive?",
        answer: "We make it easy for you to confirm material properties from our Materials Library. Each material has a detailed chart that includes specifications and properties."
    },
    {
        id: 213,
        category: "using-parts",
        question: "Do you offer welding?",
        answer: "At this time we do not offer welding at DMS Engineering. However, we do offer tapping, countersinking, and hardware installation to help bring your parts together! We also have guidance on designing for tab and slots along with other methods of joining parts."
    },
    {
        id: 214,
        category: "using-parts",
        question: "Is your powder coating fingerprint resistant?",
        answer: "Our wrinkle black powder coating is fingerprint resistant. All other colors will show fingerprints. These are easily removed by using a soft cloth with mild soap and water."
    },
    {
        id: 215,
        category: "using-parts",
        question: "Will nickel plating hold up to polishing or sanding?",
        answer: "Our nickel plating is quite thin (adding approximately ~0.0002″ per side), so you will need to be careful to avoid wearing through the finish. A small amount of light polishing may be doable but any more aggressive treatment like sanding could penetrate through to the underlying material."
    },
    {
        id: 216,
        category: "using-parts",
        question: "How to prep metal parts for painting or welding?",
        answer: "If you plan to paint or weld your metal parts after you receive them, you can use acetone to clean them up beforehand and remove all oils."
    },
    {
        id: 217,
        category: "using-parts",
        question: "Will my parts from DMS Engineering be food safe?",
        answer: "DMS Engineering does not offer a food safe production process for any service."
    },
    {
        id: 218,
        category: "using-parts",
        question: "Can I paint my parts after they’re cut?",
        answer: "You can paint your parts once they are delivered to you. Preparing laser cut metal parts for painting is simple. Before you paint, roughen the surface with a Scotch Brite pad and then thoroughly clean the parts with acetone. (Make sure to wear gloves.)"
    },
    {
        id: 219,
        category: "using-parts",
        question: "What should I expect when I get a part powder coated?",
        answer: "Powder coating adds 7-10 days to an order’s lead time. Check out the complete FAQ and our powder coating guidelines for all details, tips, and considerations!"
    }
];
