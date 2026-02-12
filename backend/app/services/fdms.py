import base64
import hashlib
import json
import tempfile
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa

from app.core.config import settings
from app.models.company_certificate import CompanyCertificate
from app.models.device import Device
from app.models.invoice import Invoice
from app.models.quotation import Quotation
from app.models.quotation_line import QuotationLine


def _write_temp_file(data: bytes, suffix: str) -> str:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(data)
    tmp.flush()
    return tmp.name


def _get_company_cert_paths(company_id: int, db) -> tuple[str, str]:
    cert = db.query(CompanyCertificate).filter(CompanyCertificate.company_id == company_id).first()
    if not cert or not cert.crt_data or not cert.key_data:
        raise ValueError("Company certificate or key not configured")
    crt_path = _write_temp_file(cert.crt_data, ".crt")
    key_path = _write_temp_file(cert.key_data, ".key")
    return crt_path, key_path


def _call_fdms(
    device: Device,
    db,
    endpoint: str,
    method: str = "POST",
    payload: dict | None = None,
    use_certificate: bool = True,
) -> dict:
    """Call an FDMS API endpoint with proper headers and mutual-TLS."""
    url = f"{settings.fdms_api_url.rstrip('/')}/{endpoint.lstrip('/')}"

    # ZIMRA requires these headers on EVERY request
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "DeviceModelName": device.model or "365Fiscal",
        "DeviceModelVersion": "1.0",
        "DeviceID": str(device.device_id),
        "DeviceSerialNo": device.serial_number or "",
    }

    cert_paths: tuple[str, str] | None = None
    if use_certificate:
        cert_paths = _get_company_cert_paths(device.company_id, db)

    try:
        resp = requests.request(
            method=method,
            url=url,
            json=payload,
            headers=headers,
            cert=cert_paths,
            verify=settings.fdms_verify_ssl,
            timeout=settings.fdms_timeout_seconds,
        )
        if not resp.ok:
            raise ValueError(f"FDMS error {resp.status_code}: {resp.text}")
        if resp.text:
            return resp.json()
        return {}
    finally:
        if cert_paths:
            for path in cert_paths:
                try:
                    import os

                    os.unlink(path)
                except Exception:
                    pass


def get_status(device: Device, db) -> dict:
    """GET /Device/v1/{deviceID}/GetStatus – returns fiscal day status, counters etc."""
    return _call_fdms(device, db, f"Device/v1/{device.device_id}/GetStatus", method="GET")


def get_config(device: Device, db) -> dict:
    """GET /Device/v1/{deviceID}/GetConfig – returns device configuration & tax tables."""
    return _call_fdms(device, db, f"Device/v1/{device.device_id}/GetConfig", method="GET")


def ping_device(device: Device, db) -> dict:
    """POST /Device/v1/{deviceID}/Ping – heartbeat, returns reportingFrequency."""
    payload = {"deviceID": str(device.device_id)}
    return _call_fdms(device, db, f"Device/v1/{device.device_id}/Ping", method="POST", payload=payload)


def _generate_ecc_csr(device: Device) -> tuple[str, str]:
    """Generate an ECC P-256 private key and CSR for ZIMRA registration.

    Returns (private_key_pem, csr_pem).
    """
    private_key = ec.generate_private_key(ec.SECP256R1())
    device_id_padded = str(int(device.device_id)).zfill(10)
    common_name = f"ZIMRA-{device.serial_number}-{device_id_padded}"

    from cryptography import x509
    from cryptography.x509.oid import NameOID

    csr = (
        x509.CertificateSigningRequestBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)]))
        .sign(private_key, hashes.SHA256())
    )
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    csr_pem = csr.public_bytes(serialization.Encoding.PEM).decode("utf-8")
    return private_key_pem, csr_pem


def register_device(device: Device, db) -> dict:
    """POST /Public/v1/{deviceID}/RegisterDevice.

    Generates an ECC CSR, sends it with the activation key to FDMS,
    and stores the returned certificate + private key on the device.
    """
    if not device.activation_key:
        raise ValueError("Activation key is required for device registration")

    private_key_pem, csr_pem = _generate_ecc_csr(device)

    payload = {
        "certificateRequest": csr_pem,
        "activationKey": device.activation_key.strip().upper(),
    }
    result = _call_fdms(
        device, db,
        f"Public/v1/{device.device_id}/RegisterDevice",
        payload=payload,
        use_certificate=False,
    )

    # Store the returned certificate and our generated private key
    returned_cert = result.get("certificate", "")
    if returned_cert:
        device.crt_data = returned_cert.encode("utf-8")
        device.crt_filename = f"device_{device.device_id}.crt"
    device.key_data = private_key_pem.encode("utf-8")
    device.key_filename = f"device_{device.device_id}.key"
    db.commit()
    db.refresh(device)

    return result


def open_day(device: Device, db) -> dict:
    """POST /Device/v1/{deviceID}/OpenDay – open a new fiscal day."""
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")
    next_day_no = (device.current_fiscal_day_no or device.last_fiscal_day_no or 0) + 1
    payload = {
        "fiscalDayNo": next_day_no,
        "fiscalDayOpened": now,
    }
    return _call_fdms(device, db, f"Device/v1/{device.device_id}/OpenDay", payload=payload)


def close_day(device: Device, db) -> dict:
    """POST /Device/v1/{deviceID}/CloseDay – close the current fiscal day."""
    payload = {
        "fiscalDayNo": device.current_fiscal_day_no or device.last_fiscal_day_no or 0,
    }
    return _call_fdms(device, db, f"Device/v1/{device.device_id}/CloseDay", payload=payload)


def _to_cents(value: Decimal) -> str:
    return str(int((value * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)))


def _sign_receipt(receipt: dict, private_key_pem: bytes) -> dict:
    key = serialization.load_pem_private_key(private_key_pem, password=None)

    device_id = str(receipt.get("deviceID", ""))
    receipt_type = str(receipt.get("receiptType", "")).upper()
    currency = str(receipt.get("receiptCurrency", "")).upper()
    global_no = str(int(receipt.get("receiptGlobalNo", 0)))
    receipt_date = str(receipt.get("receiptDate", ""))
    total_cents = _to_cents(Decimal(str(receipt.get("receiptTotal", 0))))

    concat = f"{device_id}{receipt_type}{currency}{global_no}{receipt_date}{total_cents}"

    taxes = sorted(receipt.get("receiptTaxes", []), key=lambda x: int(x.get("taxID", 0)))
    for tax in taxes:
        tax_id = str(int(tax.get("taxID", 0)))
        tax_percent = str(Decimal(str(tax.get("taxPercent", 0))).quantize(Decimal("0.01")))
        tax_amount = _to_cents(Decimal(str(tax.get("taxAmount", 0))))
        sales_amount = _to_cents(Decimal(str(tax.get("salesAmountWithTax", 0))))
        concat += f"{tax_id}{tax_percent}{tax_amount}{sales_amount}"

    data = concat.encode("utf-8")

    if isinstance(key, rsa.RSAPrivateKey):
        signature = key.sign(data, padding.PKCS1v15(), hashes.SHA256())
    elif isinstance(key, ec.EllipticCurvePrivateKey):
        signature = key.sign(data, ec.ECDSA(hashes.SHA256()))
    else:
        raise ValueError("Unsupported private key type")

    signature_b64 = base64.b64encode(signature).decode("ascii")
    signature_hash = base64.b64encode(hashlib.sha256(signature).digest()).decode("ascii")
    return {"signature": signature_b64, "hash": signature_hash, "concat": concat}


def _generate_qr(signature_b64: str, receipt_global_no: int, device_id: str, qr_base: str) -> dict:
    sig_bytes = base64.b64decode(signature_b64)
    md5_hash = hashlib.md5(sig_bytes.hex().encode("utf-8")).hexdigest().upper()
    date_str = datetime.utcnow().strftime("%d%m%Y")
    device_padded = str(int(device_id)).zfill(10)
    global_padded = str(int(receipt_global_no)).zfill(10)
    hash_part = md5_hash[:16]
    url = f"{qr_base.rstrip('/')}/{device_padded}{date_str}{global_padded}{hash_part}"
    code = "-".join(hash_part[i : i + 4] for i in range(0, len(hash_part), 4))
    return {"code": code, "url": url}


def _build_receipt(invoice: Invoice, lines: list[Any], device_id_str: str) -> dict:
    receipt_counter = (invoice.zimra_receipt_counter or 0) or 0
    receipt_global = (invoice.zimra_receipt_global_no or 0) or 0
    receipt_date = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")

    receipt_lines = []
    tax_summary: dict[str, dict[str, Decimal]] = {}
    total_with_tax = Decimal("0.00")

    for idx, line in enumerate(lines, start=1):
        qty = Decimal(str(getattr(line, "quantity", 0) or 0))
        price = Decimal(str(getattr(line, "unit_price", 0) or 0))
        vat_rate = Decimal(str(getattr(line, "vat_rate", 0) or 0))
        desc = getattr(line, "description", "") or "Item"
        uom_val = getattr(line, "uom", "") or "Units"

        line_total = (qty * price * (Decimal("1") + vat_rate / Decimal("100"))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        total_with_tax += line_total

        receipt_lines.append(
            {
                "receiptLineType": "Sale",
                "receiptLineNo": idx,
                "receiptLineName": desc,
                "receiptLineQuantity": float(qty),
                "receiptLinePrice": float(price),
                "receiptLineTotal": float(line_total),
                "receiptLineUnit": uom_val,
                "taxID": "1",
                "taxPercent": float(vat_rate),
            }
        )

        tax_key = str(vat_rate)
        if tax_key not in tax_summary:
            tax_summary[tax_key] = {
                "taxPercent": vat_rate,
                "taxAmount": Decimal("0.00"),
                "salesAmountWithTax": Decimal("0.00"),
            }
        sales_amount = line_total
        net = (sales_amount / (Decimal("1") + vat_rate / Decimal("100"))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        tax_amount = (sales_amount - net).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        tax_summary[tax_key]["taxAmount"] += tax_amount
        tax_summary[tax_key]["salesAmountWithTax"] += sales_amount

    receipt_taxes = []
    for idx, (key, data) in enumerate(tax_summary.items(), start=1):
        receipt_taxes.append(
            {
                "taxID": str(idx),
                "taxPercent": float(data["taxPercent"]),
                "taxAmount": float(data["taxAmount"]),
                "salesAmountWithTax": float(data["salesAmountWithTax"]),
            }
        )

    receipt = {
        "deviceID": device_id_str,
        "receiptType": "FiscalInvoice",
        "receiptCurrency": (invoice.currency or "USD").upper(),
        "receiptCounter": receipt_counter,
        "receiptGlobalNo": receipt_global,
        "receiptDate": receipt_date,
        "receiptLinesTaxInclusive": True,
        "receiptPrintForm": "Receipt48",
        "receiptLines": receipt_lines,
        "receiptTaxes": receipt_taxes,
        "receiptTotal": float(total_with_tax),
        "receiptPayments": [
            {"moneyTypeCode": "Cash", "paymentAmount": float(total_with_tax)}
        ],
    }
    return receipt


def submit_invoice(invoice: Invoice, db) -> dict:
    if not invoice.device_id:
        raise ValueError("Invoice has no device assigned")
    device = db.query(Device).filter(Device.id == invoice.device_id).first()
    if not device:
        raise ValueError("Device not found")

    lines: list[Any] = list(invoice.lines) if invoice.lines else []
    if not lines and invoice.quotation_id:
        quotation = db.query(Quotation).filter(Quotation.id == invoice.quotation_id).first()
        if quotation:
            lines = list(quotation.lines)

    if not lines:
        raise ValueError("Invoice has no lines to fiscalize")

    invoice.zimra_receipt_counter = (device.last_receipt_counter or 0) + 1
    invoice.zimra_receipt_global_no = (device.last_receipt_global_no or 0) + 1

    receipt = _build_receipt(invoice, lines, str(device.device_id))
    if invoice.zimra_receipt_counter > 1 and device.last_receipt_hash:
        receipt["previousReceiptHash"] = device.last_receipt_hash

    cert = db.query(CompanyCertificate).filter(CompanyCertificate.company_id == invoice.company_id).first()
    if not cert or not cert.key_data:
        raise ValueError("Company private key missing")

    sig = _sign_receipt(receipt, cert.key_data)
    receipt["receiptDeviceSignature"] = {
        "hash": sig["hash"],
        "signature": sig["signature"],
    }

    submit_payload = {"deviceID": str(device.device_id), "receipt": receipt}
    result = _call_fdms(device, db, f"Device/v1/{device.device_id}/SubmitReceipt", payload=submit_payload)

    invoice.zimra_status = "submitted"
    invoice.zimra_receipt_id = result.get("receiptID", "")
    invoice.zimra_device_signature = sig["signature"]
    invoice.zimra_device_hash = sig["hash"]
    invoice.zimra_payload = json.dumps(submit_payload)
    invoice.fiscalized_at = datetime.utcnow()

    qr_base = device.qr_url or "https://fdmstest.zimra.co.zw/Receipt"
    qr = _generate_qr(sig["signature"], invoice.zimra_receipt_global_no, str(device.device_id), qr_base)
    invoice.zimra_verification_code = qr["code"]
    invoice.zimra_verification_url = qr["url"]

    device.last_receipt_counter = invoice.zimra_receipt_counter
    device.last_receipt_global_no = invoice.zimra_receipt_global_no
    device.last_receipt_hash = sig["hash"]
    device.last_receipt_signature = sig["signature"]

    return result
