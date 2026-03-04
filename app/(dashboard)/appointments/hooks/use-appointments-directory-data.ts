"use client";

import { useMemo } from "react";

import type { BookingClient, BookingEmployee, BookingService } from "@/lib/booking-api";

type AppointmentClientOption = {
  value: string;
  label: string;
  keywords?: string;
};

type AppointmentServiceOption = {
  value: string;
  label: string;
  keywords?: string;
  price: number;
  durationMin: number;
};

type UseAppointmentsDirectoryDataParams = {
  rawEmployees: BookingEmployee[];
  clientCatalog: BookingClient[];
  serviceCatalog: BookingService[];
  selectedServiceId: string | null;
  selectedEmployeeId: string | null;
  getEmployeeColorFallback: (employeeId: string) => string;
  formatAppointmentPhoneDisplay: (value?: string | null) => string | null;
  getServiceAppointmentTypeLabel: (serviceType?: string | null) => string | null;
};

export function useAppointmentsDirectoryData({
  rawEmployees,
  clientCatalog,
  serviceCatalog,
  selectedServiceId,
  selectedEmployeeId,
  getEmployeeColorFallback,
  formatAppointmentPhoneDisplay,
  getServiceAppointmentTypeLabel,
}: UseAppointmentsDirectoryDataParams) {
  const employees = useMemo(
    () =>
      rawEmployees.map((employee) => ({
        ...employee,
        color: employee.color || getEmployeeColorFallback(employee.id),
      })),
    [getEmployeeColorFallback, rawEmployees],
  );

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee] as const)),
    [employees],
  );

  const clients = useMemo(
    () =>
      [...clientCatalog].sort((a, b) => {
        const byName = String(a.fullName || "").localeCompare(String(b.fullName || ""), "ru");
        if (byName !== 0) return byName;
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      }),
    [clientCatalog],
  );

  const clientsById = useMemo(
    () => new Map(clients.map((client) => [client.id, client] as const)),
    [clients],
  );

  const appointmentClientOptions = useMemo<AppointmentClientOption[]>(
    () =>
      clients.map((client) => {
        const phoneLabel = formatAppointmentPhoneDisplay(client.phone);
        const meta = [phoneLabel, client.iin ? `ИИН: ${client.iin}` : null].filter(Boolean).join(" · ");
        return {
          value: client.id,
          label: meta ? `${client.fullName} · ${meta}` : client.fullName,
          keywords: [client.fullName, client.phone, client.iin].filter(Boolean).join(" "),
        };
      }),
    [clients, formatAppointmentPhoneDisplay],
  );

  const services = useMemo(
    () =>
      [...serviceCatalog].sort((a, b) => {
        const nameCompare = String(a.name || "").localeCompare(String(b.name || ""), "ru");
        if (nameCompare !== 0) return nameCompare;
        return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      }),
    [serviceCatalog],
  );

  const servicesById = useMemo(
    () => new Map(services.map((service) => [service.id, service] as const)),
    [services],
  );

  const appointmentServiceOptions = useMemo<AppointmentServiceOption[]>(() => {
    if (!selectedEmployeeId) {
      const currentService = selectedServiceId ? servicesById.get(selectedServiceId) : null;
      return currentService
        ? [
            {
              value: currentService.id,
              label: `${currentService.name} · ${currentService.durationMin}м${currentService.basePrice > 0 ? ` · ${currentService.basePrice} ₸` : ""}`,
              keywords: [
                currentService.name,
                getServiceAppointmentTypeLabel(currentService.serviceType),
                currentService.serviceType,
                currentService.category,
                currentService.direction,
              ]
                .filter(Boolean)
                .join(" "),
              price: currentService.basePrice,
              durationMin: currentService.durationMin,
            },
          ]
        : [];
    }

    const options = services
      .filter((service) => service.isActive)
      .map((service) => {
        const customPrice = service.prices.find(
          (item) => item.employeeId === selectedEmployeeId && item.isActive && item.price > 0,
        );
        const resolvedPrice = customPrice?.price || service.basePrice;
        if (resolvedPrice <= 0) return null;

        const metaParts = [
          getServiceAppointmentTypeLabel(service.serviceType),
          service.category,
          service.direction,
        ].filter(Boolean);
        const metaLabel = metaParts.length ? ` · ${metaParts.join(" · ")}` : "";

        return {
          value: service.id,
          label: `${service.name}${metaLabel} · ${service.durationMin}м · ${resolvedPrice} ₸`,
          keywords: [
            service.name,
            getServiceAppointmentTypeLabel(service.serviceType),
            service.serviceType,
            service.category,
            service.direction,
          ]
            .filter(Boolean)
            .join(" "),
          price: resolvedPrice,
          durationMin: service.durationMin,
        };
      });

    const availableOptions = options.filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (selectedServiceId && !availableOptions.some((item) => item.value === selectedServiceId)) {
      const currentService = servicesById.get(selectedServiceId);
      if (currentService) {
        availableOptions.unshift({
          value: currentService.id,
          label: `${currentService.name} · недоступна для выбранного сотрудника`,
          keywords: [
            currentService.name,
            getServiceAppointmentTypeLabel(currentService.serviceType),
            currentService.serviceType,
            currentService.category,
            currentService.direction,
          ]
            .filter(Boolean)
            .join(" "),
          price: 0,
          durationMin: currentService.durationMin,
        });
      }
    }

    return availableOptions;
  }, [
    getServiceAppointmentTypeLabel,
    selectedEmployeeId,
    selectedServiceId,
    services,
    servicesById,
  ]);

  return {
    employees,
    employeesById,
    clients,
    clientsById,
    appointmentClientOptions,
    services,
    servicesById,
    appointmentServiceOptions,
  };
}
