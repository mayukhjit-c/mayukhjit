# Testing Guide for Portfolio Improvements

## Quick Test Checklist

### 1. Desktop Testing (Chrome/Edge/Firefox/Safari)
- [ ] Page loads smoothly with loading screen fade
- [ ] Time-based greeting appears after 2 seconds
- [ ] Theme colors cycle every few seconds
- [ ] Background grid has smooth hover effects
- [ ] All buttons have hover lift animation
- [ ] Scroll progress bar appears and updates
- [ ] Scroll milestone toasts at 25%, 50%, 75%, 100%

### 2. Mobile Testing (iOS/Android)
- [ ] Touch targets are at least 48x48px
- [ ] Long-press on elements with tooltips shows mobile tooltip
- [ ] Double-tap spawns particle burst with haptic feedback
- [ ] Shake device triggers theme shift (if DeviceMotion supported)
- [ ] Buttons have press-down animation (scale 0.96x)
- [ ] Smooth scrolling on all devices
- [ ] Canvas animations run at appropriate FPS

### 3. Easter Egg Testing
- [ ] Konami code (↑↑↓↓←→←→BA) triggers secret mode
- [ ] Click brand dot 7 times for message
- [ ] Triple-click logo for inspirational message
- [ ] Hold Shift while scrolling for slow-mo
- [ ] Type "dev" anywhere for developer message
- [ ] Click section icons in order (projects → vision → why → skills)
- [ ] Double-tap anywhere spawns sparkles (mobile)
- [ ] Shake device triggers message (mobile with motion sensors)

### 4. Performance Testing
- [ ] Open DevTools Performance tab
- [ ] Check FPS stays near target (30/45/60 based on device)
- [ ] Monitor CPU usage during animations
- [ ] Test on low-end device (should limit particles)
- [ ] Test with battery < 20% (should reduce effects)
- [ ] Test with slow connection (should detect and adapt)

### 5. Accessibility Testing
- [ ] Enable reduced motion in OS - particles should stop
- [ ] Navigate with keyboard only - focus visible
- [ ] Test with high contrast mode - borders visible
- [ ] Test with screen reader - content makes sense
- [ ] Zoom to 200% - layout stays functional

### 6. Browser Compatibility
- [ ] Chrome 111+ - all features work
- [ ] Chrome 80-110 - color-mix falls back
- [ ] Safari 15+ - all features work
- [ ] Firefox 115+ - most features work
- [ ] Edge 111+ - all features work

## Device Capability Testing

### Low-End Device Simulation
1. Open DevTools > Performance > CPU throttling 6x
2. Check particle count is limited to ~15
3. Canvas resolution should be 0.5x
4. Target FPS should be 30

### Battery Testing
1. Unplug device and let battery drop below 20%
2. Page should automatically reduce particle counts
3. Animations should remain smooth

### Connection Speed Testing
1. DevTools > Network > Slow 3G
2. Page should detect and adapt
3. Canvas effects may reduce

## Expected Behaviors

### Device Tiers
- **High**: Desktop/laptop with 4+ cores, 8GB+ RAM
- **Medium**: Tablets, newer phones, 2-4 cores
- **Low**: Old phones, <2 cores, <4GB RAM

### Particle Limits by Theme
- Fire: 28 base → adapted by device
- Ice: 110 base → heavily reduced on low-end
- Forest: 18 base → adapted by device
- Lilac: 28 base → adapted by device
- Fog: 28 base → adapted by device

### Performance Modes
- **Normal**: Full effects, smooth animations
- **Performance Mode**: Reduced particles (70% of normal)
- **Low Power**: Additional 50% reduction on battery
- **Reduced Motion**: Zero particles, minimal animations

## Common Issues & Solutions

### Issue: Particles lagging on mobile
**Solution**: Device should auto-detect and limit particles. If not, check DeviceCapabilities.getParticleLimit()

### Issue: Canvas not scaling properly
**Solution**: Check DeviceCapabilities.getCanvasScale() returns correct value (0.5/0.75/1)

### Issue: Easter eggs not working
**Solution**: Check console for errors. Some Easter eggs require specific conditions (motion sensors, touch support)

### Issue: Tooltips not showing on mobile
**Solution**: Must long-press (500ms) on element with data-tooltip or title attribute

### Issue: Haptic feedback not working
**Solution**: Not all devices support vibration API. Check navigator.vibrate support

## Performance Benchmarks

### Target Metrics
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Cumulative Layout Shift: < 0.1
- First Input Delay: < 100ms
- Lighthouse Performance: > 90

### Canvas Performance
- High-end: 60fps sustained
- Mid-range: 45fps sustained
- Low-end: 30fps sustained

### Memory Usage
- High-end: < 100MB
- Mid-range: < 75MB
- Low-end: < 50MB

## Debug Commands

Open browser console and try:
```javascript
// Check device tier
console.log(DeviceCapabilities.tier); // 'low', 'medium', 'high'

// Check particle limit
console.log(DeviceCapabilities.getParticleLimit()); // 15, 40, or 80

// Check canvas scale
console.log(DeviceCapabilities.getCanvasScale()); // 0.5, 0.75, or 1

// Trigger haptic feedback
window.triggerHaptic('success');

// Show toast notification
window.showToast('Test message');

// Check if reduced motion
console.log(userPrefersReducedMotion()); // true or false
```

## Automated Testing Commands

Run these in PowerShell from project directory:

```powershell
# Start local server
python -m http.server 8000

# Open in default browser
start http://localhost:8000

# Check for console errors (requires browser automation)
# Manual: Open DevTools > Console > Check for red errors
```

## Sign-Off Checklist

Before considering improvements complete:
- [ ] All features tested on 3+ different devices
- [ ] No console errors on any browser
- [ ] Performance acceptable on low-end device
- [ ] All Easter eggs functional
- [ ] Mobile experience smooth
- [ ] Accessibility features working
- [ ] Battery mode reduces effects
- [ ] Reduced motion disables animations
- [ ] All touch targets meet 48px minimum
- [ ] Documentation updated (IMPROVEMENTS.md)

---

**Testing Status**: Ready for comprehensive testing
**Last Updated**: ${new Date().toISOString()}
