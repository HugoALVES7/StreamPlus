// Renders the launcher banner (320x180 → drawn at 640x360) and icon PNGs.
// swift tools/gen_art.swift   (run from the project root)
import AppKit
import CoreText

let root = FileManager.default.currentDirectoryPath
func font(_ file: String, _ size: CGFloat) -> NSFont {
    let url = URL(fileURLWithPath: root + "/assets/web/fonts/" + file) as CFURL
    CTFontManagerRegisterFontsForURL(url, .process, nil)
    let desc = (CTFontManagerCreateFontDescriptorsFromURL(url) as! [CTFontDescriptor])[0]
    return CTFontCreateWithFontDescriptor(desc, size, nil) as NSFont
}

func render(_ w: Int, _ h: Int, _ out: String, _ draw: (CGContext) -> Void) {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8,
                               samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                               bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    draw(NSGraphicsContext.current!.cgContext)
    NSGraphicsContext.restoreGraphicsState()
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: root + "/res/drawable-nodpi/" + out))
}

let cs = CGColorSpaceCreateDeviceRGB()
func bg(_ c: CGContext, _ w: CGFloat, _ h: CGFloat) {
    let g = CGGradient(colorsSpace: cs, colors: [
        CGColor(red: 0.20, green: 0.09, blue: 0.45, alpha: 1),
        CGColor(red: 0.57, green: 0.27, blue: 1.0, alpha: 1),
        CGColor(red: 0.93, green: 0.45, blue: 0.85, alpha: 1)] as CFArray, locations: [0, 0.6, 1])!
    c.drawLinearGradient(g, start: CGPoint(x: 0, y: 0), end: CGPoint(x: w, y: h), options: [])
    // Glass highlight blob
    let r = CGGradient(colorsSpace: cs, colors: [CGColor(gray: 1, alpha: 0.35), CGColor(gray: 1, alpha: 0)] as CFArray, locations: [0, 1])!
    c.drawRadialGradient(r, startCenter: CGPoint(x: w * 0.25, y: h * 0.9), startRadius: 0,
                         endCenter: CGPoint(x: w * 0.25, y: h * 0.9), endRadius: w * 0.55, options: [])
}

/// Glyph: a rounded glass tile with a play triangle and a "+".
func glyph(_ c: CGContext, _ x: CGFloat, _ y: CGFloat, _ s: CGFloat) {
    let tile = CGPath(roundedRect: CGRect(x: x, y: y, width: s, height: s), cornerWidth: s * 0.28, cornerHeight: s * 0.28, transform: nil)
    c.addPath(tile); c.setFillColor(CGColor(gray: 1, alpha: 0.22)); c.fillPath()
    c.addPath(tile); c.setStrokeColor(CGColor(gray: 1, alpha: 0.7)); c.setLineWidth(s * 0.03); c.strokePath()
    let p = CGMutablePath()
    p.move(to: CGPoint(x: x + s * 0.34, y: y + s * 0.26))
    p.addLine(to: CGPoint(x: x + s * 0.34, y: y + s * 0.74))
    p.addLine(to: CGPoint(x: x + s * 0.74, y: y + s * 0.5))
    p.closeSubpath()
    c.addPath(p); c.setFillColor(CGColor(gray: 1, alpha: 1)); c.fillPath()
}

func text(_ s: String, _ f: NSFont, _ x: CGFloat, _ y: CGFloat) {
    NSAttributedString(string: s, attributes: [.font: f, .foregroundColor: NSColor.white]).draw(at: NSPoint(x: x, y: y))
}

for (name, sub) in [("banner.png", ""), ("banner_pip.png", "PiP")] {
    render(640, 360, name) { c in
        bg(c, 640, 360)
        glyph(c, 70, 110, 140)
        text("Stream+", font("InterDisplay-Bold.ttf", 92), 235, sub.isEmpty ? 128 : 160)
        if !sub.isEmpty { text("Picture in Picture", font("Inter-SemiBold.ttf", 36), 240, 112) }
    }
}
render(256, 256, "icon.png") { c in
    let clip = CGPath(roundedRect: CGRect(x: 0, y: 0, width: 256, height: 256), cornerWidth: 56, cornerHeight: 56, transform: nil)
    c.addPath(clip); c.clip()
    bg(c, 256, 256)
    glyph(c, 48, 48, 160)
}
print("ok")
