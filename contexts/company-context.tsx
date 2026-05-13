"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

type Company = {
  id: string
  name: string
  shortName: string | null
  industryType: string | null
}

type CompanyContextType = {
  companies: Company[]
  selectedCompany: Company | null
  setSelectedCompany: (company: Company) => void
  loading: boolean
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/companies")
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setLoading(false)
          return
        }
        setCompanies(data)
        const saved = localStorage.getItem("selectedCompanyId")
        const found = data.find((c: Company) => c.id === saved)
        if (found) {
          setSelectedCompany(found)
        } else if (data.length > 0) {
          setSelectedCompany(data[0])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSetCompany = (company: Company) => {
    setSelectedCompany(company)
    localStorage.setItem("selectedCompanyId", company.id)
  }

  return (
    <CompanyContext.Provider value={{ companies, selectedCompany, setSelectedCompany: handleSetCompany, loading }}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const context = useContext(CompanyContext)
  if (!context) {
    throw new Error("useCompany must be used within a CompanyProvider")
  }
  return context
}
