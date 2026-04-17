from __future__ import annotations

import hashlib
from pathlib import Path
import tempfile
import zipfile

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(r"d:/Frontend/DMS")
SRC_1 = ROOT / "1.docx"
SRC_2 = ROOT / "2.docx"
OUT_1 = ROOT / "1_polished_Aryan_Shahid_RC-479.docx"
OUT_2 = ROOT / "2_polished_Aryan_Shahid_RC-479.docx"
PDF_1 = ROOT / "1_polished_Aryan_Shahid_RC-479.pdf"
PDF_2 = ROOT / "2_polished_Aryan_Shahid_RC-479.pdf"
LOGO_HASH_PREFIXES = {"ab82a3b37b"}


def extract_images(docx_path: Path, out_dir: Path) -> list[Path]:
    images: list[Path] = []
    with zipfile.ZipFile(docx_path, "r") as zf:
        media_files = sorted([n for n in zf.namelist() if n.startswith("word/media/")])
        for media_name in media_files:
            ext = Path(media_name).suffix.lower() or ".img"
            with zf.open(media_name) as src:
                payload = src.read()
            digest = hashlib.md5(payload).hexdigest()
            if any(digest.startswith(prefix) for prefix in LOGO_HASH_PREFIXES):
                continue

            target = out_dir / f"img_{len(images) + 1:02d}{ext}"
            with open(target, "wb") as dst:
                dst.write(payload)
            images.append(target)
    return images


def set_base_style(doc: Document) -> None:
    style = doc.styles["Normal"]
    style.font.name = "Garamond"
    style.font.size = Pt(12)
    style.font.color.rgb = RGBColor(33, 33, 33)

    heading1 = doc.styles["Heading 1"].font
    heading1.name = "Garamond"
    heading1.size = Pt(16)
    heading1.bold = True
    heading1.color.rgb = RGBColor(26, 54, 93)

    heading2 = doc.styles["Heading 2"].font
    heading2.name = "Garamond"
    heading2.size = Pt(13)
    heading2.bold = True
    heading2.color.rgb = RGBColor(42, 73, 120)


def apply_page_borders(doc: Document) -> None:
    for section in doc.sections:
        sect_pr = section._sectPr
        pg_borders = sect_pr.find(qn("w:pgBorders"))
        if pg_borders is None:
            pg_borders = OxmlElement("w:pgBorders")
            sect_pr.append(pg_borders)

        pg_borders.set(qn("w:offsetFrom"), "page")
        for edge in ("top", "left", "bottom", "right"):
            edge_tag = qn(f"w:{edge}")
            edge_element = pg_borders.find(edge_tag)
            if edge_element is None:
                edge_element = OxmlElement(f"w:{edge}")
                pg_borders.append(edge_element)
            edge_element.set(qn("w:val"), "single")
            edge_element.set(qn("w:sz"), "12")
            edge_element.set(qn("w:space"), "24")
            edge_element.set(qn("w:color"), "7A7A7A")


def add_cover(doc: Document, report_title: str, experiment_title: str) -> None:
    p = doc.add_paragraph("COMPUTER NETWORKS")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.runs[0].bold = True
    p.runs[0].font.name = "Garamond"
    p.runs[0].font.color.rgb = RGBColor(15, 35, 62)
    p.runs[0].font.size = Pt(16)

    p = doc.add_paragraph(report_title)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.runs[0].bold = True
    p.runs[0].font.name = "Garamond"
    p.runs[0].font.color.rgb = RGBColor(26, 54, 93)
    p.runs[0].font.size = Pt(14)

    doc.add_paragraph("")
    doc.add_paragraph("Name: Aryan Shahid")
    doc.add_paragraph("Roll No: RC-479")
    doc.add_paragraph("National University of Modern Languages")
    doc.add_paragraph("Department of Computer Science, Rawalpindi")
    doc.add_paragraph(f"Experiment: {experiment_title}")
    doc.add_page_break()


def add_images_with_captions(doc: Document, images: list[Path], caption_prefix: str) -> None:
    doc.add_heading("Screenshots and Evidence", level=1)
    for idx, img in enumerate(images, start=1):
        try:
            doc.add_picture(str(img), width=Inches(5.9))
            cap = doc.add_paragraph(f"Figure {idx}: {caption_prefix} (Snapshot {idx}).")
            cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        except Exception:
            doc.add_paragraph(f"Figure {idx}: Image could not be embedded due to format restrictions.")


def build_report_9(images: list[Path], out_file: Path) -> None:
    doc = Document()
    set_base_style(doc)
    apply_page_borders(doc)

    add_cover(
        doc,
        report_title="LAB REPORT 9",
        experiment_title="Setting Up Basic Router Configurations",
    )

    doc.add_heading("Objectives", level=1)
    objectives = [
        "Configure hostnames on Cisco routers to improve device identification.",
        "Secure routers with enable secret, console, and auxiliary access controls.",
        "Assign IPv4 addresses to router interfaces and enable interfaces.",
        "Configure RIP version 2 routing with no auto-summary.",
        "Validate routing behavior through routing and interface verification commands.",
    ]
    for item in objectives:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("Equipment and Software", level=1)
    for item in [
        "A PC or laptop with Cisco Packet Tracer installed.",
        "Three Cisco routers (e.g., 1941 model in simulation).",
        "Required cables for inter-router and LAN-side connectivity.",
        "Optional internet access for command references.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("Theoretical Background", level=1)
    doc.add_heading("Router Identification and Access Security", level=2)
    doc.add_paragraph(
        "Routers should never remain with default naming in multi-device topologies. "
        "Meaningful hostnames reduce configuration errors and simplify troubleshooting. "
        "Security hardening starts with privileged access control (enable secret) and line-level passwords. "
        "Using encrypted secrets is preferred over legacy plain-text alternatives."
    )

    doc.add_heading("RIP Version 2", level=2)
    doc.add_paragraph(
        "RIP v2 is a dynamic routing protocol that uses hop count as a metric and supports classless routing. "
        "It is suitable for small to medium academic topologies where quick configuration and visibility are priorities. "
        "Disabling auto-summary is important when subnet boundaries must be advertised accurately across links."
    )

    doc.add_heading("MOTD Banner", level=2)
    doc.add_paragraph(
        "A Message of the Day (MOTD) banner is displayed before login and serves legal and administrative notice purposes. "
        "It is a standard security practice in network environments."
    )

    doc.add_heading("Practical Procedure", level=1)
    steps = [
        "Created the network topology with three interconnected routers (R1, R2, and R3).",
        "Configured unique hostnames and secured device access using enable secret and line passwords.",
        "Assigned IPv4 addresses to all active interfaces and enabled each interface with no shutdown.",
        "Configured RIP version 2 and advertised all directly connected networks.",
        "Disabled route auto-summarization on each router to avoid classful route compression.",
        "Applied MOTD banners and performed final verification checks.",
    ]
    for step in steps:
        doc.add_paragraph(step, style="List Number")

    doc.add_heading("Core Verification Commands", level=1)
    for cmd in [
        "show ip interface brief",
        "show ip route",
        "show ip protocols",
        "show running-config",
    ]:
        p = doc.add_paragraph(cmd)
        p.runs[0].font.name = "Consolas"

    doc.add_heading("Results and Discussion", level=1)
    doc.add_paragraph(
        "The routers successfully formed RIP adjacencies and learned remote networks, confirming dynamic route exchange. "
        "Routing tables reflected expected route types, and interface checks verified operational status. "
        "Security settings and MOTD banners were correctly applied across all devices."
    )

    doc.add_heading("Conclusion", level=1)
    doc.add_paragraph(
        "This experiment validated foundational router configuration skills, including device hardening, interface addressing, "
        "and dynamic routing deployment. The exercise also highlighted the importance of structured verification after each "
        "configuration stage to ensure reliable network behavior."
    )

    add_images_with_captions(doc, images, "Router setup, command execution, and output verification")
    doc.save(out_file)


def build_report_8(images: list[Path], out_file: Path) -> None:
    doc = Document()
    set_base_style(doc)
    apply_page_borders(doc)

    add_cover(
        doc,
        report_title="LAB REPORT 8",
        experiment_title="Switch Redundant Connections and Loops (STP)",
    )

    doc.add_heading("Objectives", level=1)
    objectives = [
        "Understand why switching loops occur in redundant topologies.",
        "Study root bridge election and blocked-port logic in STP.",
        "Manually influence root bridge selection by adjusting bridge priority.",
        "Enable Rapid STP (RSTP) and compare convergence speed with classic STP.",
        "Validate connectivity using DHCP assignment, ping tests, and HTTP access.",
    ]
    for item in objectives:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("Equipment and Software", level=1)
    for item in [
        "A PC or laptop with Cisco Packet Tracer.",
        "Three Cisco 2960 switches in simulated topology.",
        "Copper straight-through cables for redundant links.",
        "Server and end devices for DHCP and HTTP validation.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("Theoretical Background", level=1)
    doc.add_heading("Spanning Tree Protocol", level=2)
    doc.add_paragraph(
        "Redundant paths improve reliability but can trigger broadcast storms when loops are present. "
        "STP prevents this by logically blocking selected links while retaining redundancy for failover."
    )

    doc.add_heading("Root Bridge Selection", level=2)
    doc.add_paragraph(
        "STP selects a root bridge using the lowest bridge ID, which combines bridge priority and MAC address. "
        "When priorities are equal, MAC address decides the winner. Administrators can intentionally set a lower "
        "priority on a stronger core switch to control path decisions."
    )

    doc.add_heading("Rapid STP (RSTP)", level=2)
    doc.add_paragraph(
        "RSTP (IEEE 802.1w) significantly reduces convergence time after topology changes and link failures. "
        "In practical deployments, faster convergence means lower packet loss and quicker service restoration."
    )

    doc.add_heading("Practical Procedure", level=1)
    steps = [
        "Built a triangular switch topology to intentionally create redundant paths.",
        "Observed default STP behavior and identified root bridge and blocked ports.",
        "Configured SW1 with lower bridge priority to force root bridge role.",
        "Enabled RSTP mode across all switches and re-validated spanning tree status.",
        "Configured DHCP service for automatic host addressing.",
        "Tested end-to-end reachability through ping and HTTP browser access.",
    ]
    for step in steps:
        doc.add_paragraph(step, style="List Number")

    doc.add_heading("Core Verification Commands", level=1)
    for cmd in [
        "show spanning-tree",
        "show spanning-tree vlan 1",
        "spanning-tree vlan 1 priority 4096",
        "spanning-tree mode rapid-pvst",
        "ipconfig /all",
        "ping <destination-ip>",
    ]:
        p = doc.add_paragraph(cmd)
        p.runs[0].font.name = "Consolas"

    doc.add_heading("Results and Discussion", level=1)
    doc.add_paragraph(
        "The topology demonstrated how STP safely blocks redundant links to avoid loops while preserving failover. "
        "After priority tuning, SW1 became the root bridge as expected. RSTP activation shortened recovery time "
        "after simulated link disruption. DHCP allocation and HTTP access confirmed successful Layer 2 and Layer 3 service flow."
    )

    doc.add_heading("Conclusion", level=1)
    doc.add_paragraph(
        "This lab provided practical understanding of loop prevention and resilient switching behavior. "
        "It also connected STP fundamentals with real service validation through DHCP and web connectivity tests, "
        "making the experiment both conceptual and operationally meaningful."
    )

    add_images_with_captions(doc, images, "STP or RSTP topology, command output, and connectivity validation")
    doc.save(out_file)


def export_pdf(input_docx: Path, output_pdf: Path) -> tuple[bool, str]:
    try:
        from docx2pdf import convert
        convert(str(input_docx), str(output_pdf))
        return True, "ok"
    except Exception as exc:
        return False, str(exc)


def main() -> None:
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        d1 = tmp / "r1"
        d2 = tmp / "r2"
        d1.mkdir(parents=True, exist_ok=True)
        d2.mkdir(parents=True, exist_ok=True)
        imgs1 = extract_images(SRC_1, d1)
        imgs2 = extract_images(SRC_2, d2)

        build_report_9(imgs1, OUT_1)
        build_report_8(imgs2, OUT_2)

    ok1, msg1 = export_pdf(OUT_1, PDF_1)
    ok2, msg2 = export_pdf(OUT_2, PDF_2)

    print(f"DOCX created: {OUT_1.name}")
    print(f"DOCX created: {OUT_2.name}")
    print(f"PDF 1 status: {'OK' if ok1 else 'FAILED'} ({msg1})")
    print(f"PDF 2 status: {'OK' if ok2 else 'FAILED'} ({msg2})")


if __name__ == "__main__":
    main()
