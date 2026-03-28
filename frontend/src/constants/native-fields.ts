export interface NativeFieldDef {
  slug: string
  label: string
  defaultRequired: boolean
}

export const NATIVE_FIELDS: Record<string, NativeFieldDef[]> = {
  contact: [
    { slug: 'name', label: 'Nome', defaultRequired: true },
    { slug: 'email', label: 'E-mail', defaultRequired: false },
    { slug: 'phone', label: 'Telefone', defaultRequired: false },
    { slug: 'cpf', label: 'CPF', defaultRequired: false },
    { slug: 'dateOfBirth', label: 'Data de Nascimento', defaultRequired: false },
    { slug: 'company', label: 'Empresa', defaultRequired: false },
    { slug: 'jobTitle', label: 'Cargo', defaultRequired: false },
    { slug: 'address', label: 'Endereço', defaultRequired: false },
  ],
  company: [
    { slug: 'name', label: 'Nome', defaultRequired: true },
    { slug: 'cnpj', label: 'CNPJ', defaultRequired: false },
    { slug: 'phone', label: 'Telefone', defaultRequired: false },
    { slug: 'website', label: 'Website', defaultRequired: false },
    { slug: 'segment', label: 'Segmento', defaultRequired: false },
    { slug: 'employeeCount', label: 'Nº Funcionários', defaultRequired: false },
    { slug: 'annualRevenue', label: 'Receita Anual', defaultRequired: false },
    { slug: 'address', label: 'Endereço', defaultRequired: false },
  ],
  lead: [
    { slug: 'contact', label: 'Contato', defaultRequired: false },
    { slug: 'status', label: 'Status', defaultRequired: true },
    { slug: 'score', label: 'Score', defaultRequired: false },
    { slug: 'source', label: 'Origem', defaultRequired: false },
  ],
  opportunity: [
    { slug: 'title', label: 'Título', defaultRequired: true },
    { slug: 'pipeline', label: 'Funil', defaultRequired: true },
    { slug: 'stage', label: 'Etapa', defaultRequired: true },
    { slug: 'value', label: 'Valor', defaultRequired: false },
    { slug: 'closeDate', label: 'Data de Fechamento', defaultRequired: false },
    { slug: 'contact', label: 'Contato', defaultRequired: false },
    { slug: 'company', label: 'Empresa', defaultRequired: false },
    { slug: 'responsible', label: 'Responsável', defaultRequired: false },
    { slug: 'description', label: 'Descrição', defaultRequired: false },
  ],
  task: [
    { slug: 'title', label: 'Título', defaultRequired: true },
    { slug: 'type', label: 'Tipo', defaultRequired: true },
    { slug: 'dueDate', label: 'Data/Hora', defaultRequired: false },
    { slug: 'priority', label: 'Prioridade', defaultRequired: false },
    { slug: 'description', label: 'Descrição', defaultRequired: false },
    { slug: 'assignedTo', label: 'Responsável', defaultRequired: false },
    { slug: 'opportunity', label: 'Oportunidade', defaultRequired: false },
    { slug: 'contact', label: 'Contato', defaultRequired: false },
  ],
}
