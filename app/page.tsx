"use client";
import React, { useState, useEffect } from "react";
import { Input, DatePicker, TimePicker, InputNumber, Button, Table, AutoComplete, Select, message } from "antd";
import type { Dayjs } from "dayjs";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import dayjs from "dayjs";

interface Employee { MaNhanVien: string; TenNhanVien: string }
interface CaLam {
  key: number;
  ma: string;
  ten: string;
  thoigianbd: string;
  thoigiankt: string;
  nghi: number;
  diadiem: string;
  vaitro: string;
  congchuan: number;
}

function removeVietnameseTones(str: string) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase();
}

export default function Page() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [maInput, setMaInput] = useState(""); // auto-complete input

  const [form, setForm] = useState({
    ma: "",
    ten: "",
    ngay: null as Dayjs | null,
    batdau: null as Dayjs | null,
    ketthuc: null as Dayjs | null,
    giolam: "" as number | "",
    nghi: 0,
    diadiem: "",
    vaitro: "",
  });
  const [data, setData] = useState<CaLam[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    // Đọc danh sách nhân viên
    fetch("/id.csv")
      .then(r => r.text())
      .then(text => {
        const res = Papa.parse(text, { header: true, skipEmptyLines: true }) as any;
        setEmployees(res.data.filter((e: Employee) => e.MaNhanVien && e.TenNhanVien));
      });
    // Đọc danh sách địa điểm
    fetch("/locations.csv")
      .then(r => r.text())
      .then(text => {
        const res = Papa.parse(text, { header: true, skipEmptyLines: true }) as any;
        setLocations(res.data.map((e: { Location: string }) => e.Location).filter(Boolean));
      });
  }, []);

  // Sinh gợi ý cho mã nhân viên
  const getMaOptions = (input: string) => {
    if (!input) return [];
    const inputNorm = removeVietnameseTones(input);
    return employees
      .filter(e => {
        const ma = removeVietnameseTones(e.MaNhanVien);
        const ten = removeVietnameseTones(e.TenNhanVien);
        return ma.includes(inputNorm) || ten.includes(inputNorm);
      })
      .slice(0, 10)
      .map(e => ({
        value: e.MaNhanVien,
        label: `${e.MaNhanVien} - ${e.TenNhanVien}`,
      }));
  };

  const handleMaChange = (value: string) => {
    setMaInput(value);
    const emp = employees.find(e => e.MaNhanVien === value);
    setForm(f => ({
      ...f,
      ma: value,
      ten: emp ? emp.TenNhanVien : "",
    }));
    setErrors(e => ({
      ...e,
      ma: false,
      ten: false,
    }));
  };
  const handleMaSelect = (value: string) => {
    setMaInput(value);
    const emp = employees.find(e => e.MaNhanVien === value);
    setForm(f => ({
      ...f,
      ma: value,
      ten: emp ? emp.TenNhanVien : "",
    }));
    setErrors(e => ({
      ...e,
      ma: false,
      ten: false,
    }));
  };
  const handleChange = (field: string, value: any) => {
    let nextForm = { ...form, [field]: value };
    if ((field === "batdau" && form.ketthuc) || (field === "ketthuc" && form.batdau)) {
      if (nextForm.batdau && nextForm.ketthuc) {
        const diff = dayjs(nextForm.ketthuc).diff(dayjs(nextForm.batdau), "minute") / 60;
        nextForm.giolam = diff > 0 ? Number(diff.toFixed(2)) : "";
      }
    }
    if ((field === "batdau" && form.giolam) || (field === "giolam" && form.batdau)) {
      if (nextForm.batdau && nextForm.giolam) {
        const bd = dayjs(nextForm.batdau);
        const kt = bd.add(Number(nextForm.giolam) * 60, "minute");
        nextForm.ketthuc = kt;
      }
    }
    if (field === "giolam" && !value) {
      nextForm.ketthuc = null;
    }
    setForm(nextForm);
    setErrors({});
  };

  function tinhCongChuan(bd: Dayjs, kt: Dayjs, nghi: number) {
    const minutes = kt.diff(bd, "minute") - (nghi || 0);
    return minutes > 0 ? Number((minutes / 60).toFixed(2)) : 0;
  }

  const validate = () => {
    let errs: { [key: string]: boolean } = {};
    const emp = employees.find(e => e.MaNhanVien === form.ma);
    if (!form.ma || !emp) errs["ma"] = true;
    if (!form.ten) errs["ten"] = true;
    ["ngay", "batdau", "ketthuc"].forEach(field => {
      if (!form[field as keyof typeof form]) errs[field] = true;
    });
    if (!form.diadiem) errs["diadiem"] = true; // validate địa điểm phải chọn
    if (form.nghi < 0) errs["nghi"] = true;
    return errs;
  };

  // Giữ lại mã, tên, ngày làm sau khi nhập ca
  const handleAdd = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      message.error("Vui lòng nhập đúng và đủ thông tin!");
      return;
    }
    const congchuan = tinhCongChuan(form.batdau!, form.ketthuc!, form.nghi);
    setData(prev => [
      ...prev,
      {
        key: Date.now(),
        ma: form.ma.trim(),
        ten: form.ten.trim(),
        thoigianbd: form.ngay!.format("DD/MM/YYYY") + " " + form.batdau!.format("HH:mm"),
        thoigiankt: form.ngay!.format("DD/MM/YYYY") + " " + form.ketthuc!.format("HH:mm"),
        nghi: form.nghi,
        diadiem: form.diadiem,
        vaitro: form.vaitro || "",
        congchuan,
      }
    ]);
    setForm({
      ...form,
      batdau: null,
      ketthuc: null,
      giolam: "",
      nghi: 0,
      diadiem: "",
      vaitro: "",
    });
    setErrors({});
  };

  const removeRow = (key: number) => setData(prev => prev.filter(row => row.key !== key));

  const exportExcel = () => {
    if (data.length === 0) {
      message.error("Không có dữ liệu để xuất!");
      return;
    }
    const wsData = [
      [
        "Mã nhân viên",
        "Tên nhân viên",
        "Thời gian bắt đầu",
        "Thời gian kết thúc",
        "Thời gian nghỉ",
        "Địa điểm",
        "Vai trò",
        "Công chuẩn"
      ],
      ...data.map(r => [
        r.ma,
        r.ten,
        r.thoigianbd,
        r.thoigiankt,
        r.nghi,
        r.diadiem,
        r.vaitro,
        r.congchuan
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "ds_ca_lam.xlsx");
  };

  const columns = [
    { title: "Mã nhân viên", dataIndex: "ma", key: "ma", width: 130 },
    { title: "Tên nhân viên", dataIndex: "ten", key: "ten", width: 180 },
    { title: "Thời gian bắt đầu", dataIndex: "thoigianbd", key: "thoigianbd", width: 160 },
    { title: "Thời gian kết thúc", dataIndex: "thoigiankt", key: "thoigiankt", width: 160 },
    { title: "Thời gian nghỉ", dataIndex: "nghi", key: "nghi", width: 90 },
    { title: "Địa điểm", dataIndex: "diadiem", key: "diadiem", width: 170 },
    { title: "Vai trò", dataIndex: "vaitro", key: "vaitro", width: 120 },
    { title: "Công chuẩn", dataIndex: "congchuan", key: "congchuan", width: 100 },
    {
      title: "Xóa",
      key: "action",
      width: 70,
      render: (_: any, record: CaLam) => (
        <Button danger size="small" onClick={() => removeRow(record.key)}>Xóa</Button>
      ),
    },
  ];

  // Style form: nhỏ, đẹp, không phụ thuộc bảng
  const fieldRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "124px 1fr", alignItems: "center", marginBottom: 15, columnGap: 34 };
  const labelColStyle: React.CSSProperties = { fontWeight: 500, fontSize: 13, whiteSpace: "nowrap", marginBottom: 0 };
  const inputStyle: React.CSSProperties = { width: "100%", minHeight: 32, fontSize: 15, borderRadius: 6 };

  return (
    <div>
      {/* FORM nhỏ phía trên */}
      <div style={{ maxWidth: 520, margin: "24px auto 0 auto", padding: 18, background: "#fafafa", borderRadius: 8, boxShadow: "0 0 8px #e4e4e4" }}>
        <h2 style={{ marginBottom: 17, fontSize: 18, textAlign: "center" }}>Nhập thông tin ca làm</h2>
        <form autoComplete="off">
          <div style={fieldRowStyle}>
            <label style={labelColStyle}>Mã nhân viên *</label>
            <AutoComplete
              style={{
                ...inputStyle,
                borderColor: errors.ma ? "#ff4d4f" : undefined,
                background: errors.ma ? "#fff1f0" : undefined
              }}
              options={getMaOptions(maInput)}
              value={form.ma}
              onChange={handleMaChange}
              onSelect={handleMaSelect}
              placeholder="Nhập mã nhân viên"
              filterOption={false}
            />
          </div>
          <div style={fieldRowStyle}>
            <label style={labelColStyle}>Tên nhân viên</label>
            <Input value={form.ten} disabled style={{ ...inputStyle, background: "#f5f5f5" }} />
          </div>
          <div style={fieldRowStyle}>
            <label style={labelColStyle}>Ngày làm *</label>
            <DatePicker
              value={form.ngay}
              onChange={d => handleChange("ngay", d)}
              format="DD-MM-YYYY"
              style={{ ...inputStyle, ...(errors.ngay ? { borderColor: "#ff4d4f", background: "#fff1f0" } : {}) }}
              allowClear
              inputReadOnly={false}
            />
          </div>
          <div style={fieldRowStyle}>
            <label style={labelColStyle}>Thời gian bắt đầu *</label>
            <TimePicker value={form.batdau} onChange={t => handleChange("batdau", t)} format="HH:mm" style={{ ...inputStyle, ...(errors.batdau ? { borderColor: "#ff4d4f", background: "#fff1f0" } : {}) }} />
          </div>
          <div style={fieldRowStyle}>
            <label style={labelColStyle}>Thời gian kết thúc *</label>
            <TimePicker value={form.ketthuc} onChange={t => handleChange("ketthuc", t)} format="HH:mm" style={{ ...inputStyle, ...(errors.ketthuc ? { borderColor: "#ff4d4f", background: "#fff1f0" } : {}) }} />
          </div>
          <div style={fieldRowStyle}>
            <label style={labelColStyle}>Thời gian làm việc của ca (giờ)</label>
            <InputNumber value={form.giolam} min={0} step={0.25} style={inputStyle} onChange={v => handleChange("giolam", v)} />
          </div>
          <div style={fieldRowStyle}>
            <label style={labelColStyle}>Thời gian nghỉ (phút) *</label>
            <InputNumber value={form.nghi} min={0} style={{ ...inputStyle, ...(errors.nghi ? { borderColor: "#ff4d4f", background: "#fff1f0" } : {}) }} onChange={v => handleChange("nghi", v ?? 0)} />
          </div>
          <div style={fieldRowStyle}>
            <label style={labelColStyle}>Địa điểm *</label>
            <div style={{ width: "100%" }}>
              <Select
                style={{
                  ...inputStyle,
                  borderColor: errors.diadiem ? "#ff4d4f" : undefined,
                  background: errors.diadiem ? "#fff1f0" : undefined,
                }}
                value={form.diadiem || undefined}
                onChange={value => handleChange("diadiem", value)}
                placeholder="Chọn địa điểm"
                allowClear
                options={locations.map(l => ({ value: l, label: l }))}
              />
              {errors.diadiem && (
                <div style={{ color: "#ff4d4f", fontSize: 13, marginTop: 2 }}>
                  Vui lòng chọn địa điểm làm việc
                </div>
              )}
            </div>
          </div>
          <div style={fieldRowStyle}>
            <label style={labelColStyle}>Vai trò</label>
            <Input value={form.vaitro} onChange={e => handleChange("vaitro", e.target.value)} style={inputStyle} />
          </div>
          <div style={{ textAlign: "right", marginTop: 16 }}>
            <Button type="primary" onClick={handleAdd}>Input</Button>
          </div>
        </form>
      </div>

      {/* Bảng review: tách hoàn toàn, luôn đủ rộng */}
      <div
        style={{
          margin: "36px auto 0 auto",
          width: "100%",
          maxWidth: "none",
          minWidth: 1200,
          overflowX: "auto",
          background: "#fafafa",
          borderRadius: 8,
          boxShadow: "0 0 8px #e4e4e4",
          padding: "26px 24px 32px 24px",
        }}
      >
        <h2 style={{ fontSize: 19, marginBottom: 12 }}>Bảng review</h2>
        <Table
          columns={columns}
          dataSource={data}
          pagination={false}
          size="middle"
          scroll={{ x: 1300 }}
          style={{ minWidth: 1200 }}
        />
        <Button type="primary" style={{ marginTop: 18 }} onClick={exportExcel}>
          Export to Excel
        </Button>
      </div>
    </div>
  );
}
