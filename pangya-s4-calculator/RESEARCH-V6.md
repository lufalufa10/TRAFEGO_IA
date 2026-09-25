# PangYa S4 Calculator — V6 accuracy notes

## Confirmed conventions

- Core physics: Acrisio SuperSS Smart Calculator / PangYaC derivative.
- Engine spin input is the applied ball contact/spin amount, normalized internally as spin / 30.
- Current Smart Calculator documentation: negative spin (-1..-30) = upper contact point and shorter carry; positive (1..30) = lower contact point and longer carry.
- Game control documentation identifies upper contact as Top/Front spin and lower contact as Backspin.
- PangYaC "Optimal Spin" searches applied spin values from the configured maximum down to zero.
- Common historical Tomahawk reference: applied spin 7.
- S4 uses the old caliper system; S5/United uses the newer decimal caliper.

## Aiming units

Acrisio's physical lateral output is in yards. It must not be labeled directly as a visual square.

V6 modes:
- field800: user empirical calibration, default 1.25 physical lateral yards per user's visual square.
- green15: 1.5 yard green cell.
- green20: 2.0 yard green cell.
- smart800: current Smart Calculator SmartView conversion using 800x600 PB-small scale.

The 1.25 field scale is one empirical anchor, not a universal PangYa constant.

## Force

V6 reports continuous target force in yards and the enclosing old-bar interval using 1/360 of the current power range.
The earlier -2y field correction is disabled because the tested shot did not record whether the applied spin was Back or Front.

## Remaining accuracy limiters

1. Wind angle: strong winds near 0/180 degrees are extremely sensitive to pixel-angle error.
2. Ball slope: slope materially changes lateral deviation and must not be assumed zero on uneven lies.
3. OCR: recognized values must still be checked before a tournament shot.
4. 2W and 3W remain beta until field-calibrated.

## Field calibration record

Pending:
- 1W 270 +10y, 239y, -9.45m, wind1 @90, terrain100, applied spin3.
- Calculator pre-V6: ~232.4y / raw lateral ~0.63y.
- User practical reference: ~2y less force / ~0.50 visual square.
- Spin direction was not recorded, so force correction is intentionally not generalized.
