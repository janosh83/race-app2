from PIL import ExifTags, Image
from PIL.TiffImagePlugin import IFDRational

from app.utils import extract_image_coordinates


def dms(degrees, minutes=0, seconds=0):
    return (IFDRational(degrees, 1), IFDRational(minutes, 1), IFDRational(seconds, 1))


def write_jpeg(path, gps=None, orientation=None):
    """Write a small JPEG with optional GPS directory and Orientation tag."""
    exif = Image.Exif()
    if orientation is not None:
        exif[ExifTags.Base.Orientation] = orientation
    if gps is not None:
        exif.get_ifd(ExifTags.IFD.GPSInfo).update(gps)
    Image.new('RGB', (40, 20), 'red').save(path, exif=exif.tobytes())
    return str(path)


def gps_tags(lat, lat_ref, lon, lon_ref):
    return {
        ExifTags.GPS.GPSLatitudeRef: lat_ref,
        ExifTags.GPS.GPSLatitude: lat,
        ExifTags.GPS.GPSLongitudeRef: lon_ref,
        ExifTags.GPS.GPSLongitude: lon,
    }


def test_extracts_north_east_coordinates(tmp_path):
    path = write_jpeg(tmp_path / 'ne.jpg', gps_tags(dms(50, 5, 30), 'N', dms(14, 25, 0), 'E'), orientation=6)

    lat, lon = extract_image_coordinates(path)

    assert round(lat, 6) == round(50 + 5 / 60 + 30 / 3600, 6)
    assert round(lon, 6) == round(14 + 25 / 60, 6)


def test_south_and_west_are_negative(tmp_path):
    path = write_jpeg(tmp_path / 'sw.jpg', gps_tags(dms(33, 52), 'S', dms(151, 12), 'W'))

    lat, lon = extract_image_coordinates(path)

    assert lat < 0 and lon < 0


def test_zero_denominator_values_are_not_stored_as_a_position(tmp_path):
    no_fix = (IFDRational(0, 0), IFDRational(0, 0), IFDRational(0, 0))
    path = write_jpeg(tmp_path / 'nofix.jpg', gps_tags(no_fix, 'N', no_fix, 'E'))

    assert extract_image_coordinates(path) == (None, None)


def test_incomplete_gps_returns_none(tmp_path):
    path = write_jpeg(tmp_path / 'partial.jpg', {ExifTags.GPS.GPSLatitudeRef: 'N', ExifTags.GPS.GPSLatitude: dms(50)})

    assert extract_image_coordinates(path) == (None, None)


def test_image_without_gps_returns_none(tmp_path):
    assert extract_image_coordinates(write_jpeg(tmp_path / 'plain.jpg')) == (None, None)
    assert extract_image_coordinates(write_jpeg(tmp_path / 'oriented.jpg', orientation=3)) == (None, None)


def test_unreadable_file_returns_none(tmp_path):
    path = tmp_path / 'broken.jpg'
    path.write_bytes(b'not an image')

    assert extract_image_coordinates(str(path)) == (None, None)
