import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, BarElement } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, BarElement);

// Property tax calculation
const calculatePropertyTax = (propertyValue, mode, customAmount) => {
    if (propertyValue <= 0) return 0;

    if (mode === 'oslo') {
        const taxableBase = Math.max(0, (propertyValue * 0.7) - 4700000);
        return taxableBase * 0.00235;
    } else {
        return customAmount;
    }
};

// URL parameter handling
const encodeParams = (params) => {
    const urlParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            urlParams.set(key, value.toString());
        }
    });
    return urlParams.toString();
};

const decodeParams = () => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const result = {};
    params.forEach((value, key) => {
        result[key] = value;
    });
    return result;
};

// Main App Component
const App = () => {
    // Load initial state from URL if available
    const urlParams = useMemo(() => decodeParams(), []);
    
    // State for calculation mode
    const [calculationMode, setCalculationMode] = useState(urlParams.cm || 'byPrice'); // 'byPayment' or 'byPrice'
    
    // State for collapsible sections
    const [expandedSections, setExpandedSections] = useState({
        distribution: false,
        costs: false,
        propertyTax: false,
        investmentAnalysis: false,
        details: false
    });
    
    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Inputs (with URL params as defaults)
    const [loanType] = useState(urlParams.lt || 'annuity'); // Alltid annuitetslån for beregninger
    const [interestRate, setInterestRate] = useState(parseFloat(urlParams.ir) || 5.2);
    const [loanTerm, setLoanTerm] = useState(parseInt(urlParams.term) || 25);
    const [downPayment1, setDownPayment1] = useState(parseInt(urlParams.dp1) || 1000000);
    const [downPayment2, setDownPayment2] = useState(parseInt(urlParams.dp2) || 0);
    const [ownershipSplit, setOwnershipSplit] = useState(parseInt(urlParams.os) || 100);
    const [municipalDues, setMunicipalDues] = useState(parseInt(urlParams.md) || 15000);
    const [homeInsurance, setHomeInsurance] = useState(parseInt(urlParams.hi) || 0);
    const [hoa, setHoa] = useState(parseInt(urlParams.hoa) || 0);
    const [maintenance, setMaintenance] = useState(parseInt(urlParams.maint) || 24000);
    const [annualAppreciation, setAnnualAppreciation] = useState(parseFloat(urlParams.aa) || 3.0);
    const [requiredReturn, setRequiredReturn] = useState(parseFloat(urlParams.rr) || 5.0);
    const [rentalIncome, setRentalIncome] = useState(parseInt(urlParams.ri) || 0);
    const [alternativeRentCost, setAlternativeRentCost] = useState(parseInt(urlParams.arc) || 20000); // Ny input for klassisk sammenligning

    // Property tax settings
    const [propertyTaxMode, setPropertyTaxMode] = useState(urlParams.ptm || 'oslo'); // 'oslo' or 'custom'
    const [customPropertyTaxAmount, setCustomPropertyTaxAmount] = useState(parseInt(urlParams.cpt) || 5000);

    // Mode-specific inputs
    const [desiredMonthlyPayment, setDesiredMonthlyPayment] = useState(parseInt(urlParams.dmp) || 20000);
    const [propertyValue, setPropertyValue] = useState(parseInt(urlParams.pv) || 5000000);

    // Calculated Outputs
    const [loanAmount, setLoanAmount] = useState(0);
    const [finalPropertyValue, setFinalPropertyValue] = useState(0);
    const [calculatedMonthlyPayment, setCalculatedMonthlyPayment] = useState(0);
    const [amortizationData, setAmortizationData] = useState([]);
    const [payoffDate, setPayoffDate] = useState('');
    const [totalMonthlyCost, setTotalMonthlyCost] = useState(0);
    const [netMonthlyCost, setNetMonthlyCost] = useState(0);
    const [totalInterest, setTotalInterest] = useState(0);
    const [loanDetails1, setLoanDetails1] = useState({ 
        amount: 0, 
        payment: 0, 
        amortization: [],
        annuityPayment: 0,
        serialFirstPayment: 0,
        serialLastPayment: 0
    });
    const [loanDetails2, setLoanDetails2] = useState({ 
        amount: 0, 
        payment: 0, 
        amortization: [],
        annuityPayment: 0,
        serialFirstPayment: 0,
        serialLastPayment: 0
    });
    const [propertyTax, setPropertyTax] = useState(0);
    
    // Update URL with current state
    const updateURL = useCallback(() => {
        const params = {
            cm: calculationMode,
            lt: loanType,
            ir: interestRate,
            term: loanTerm,
            dp1: downPayment1,
            dp2: downPayment2,
            os: ownershipSplit,
            md: municipalDues,
            hi: homeInsurance,
            hoa: hoa,
            maint: maintenance,
            aa: annualAppreciation,
            rr: requiredReturn,
            ri: rentalIncome,
            arc: alternativeRentCost,
            ptm: propertyTaxMode,
            cpt: customPropertyTaxAmount,
            dmp: desiredMonthlyPayment,
            pv: propertyValue
        };
        
        const hash = encodeParams(params);
        window.location.hash = hash;
    }, [
        calculationMode, loanType, interestRate, loanTerm, downPayment1, downPayment2,
        ownershipSplit, municipalDues, homeInsurance, hoa, maintenance, annualAppreciation,
        requiredReturn, rentalIncome, alternativeRentCost, propertyTaxMode, customPropertyTaxAmount,
        desiredMonthlyPayment, propertyValue
    ]);
    
    // Debounced URL update
    useEffect(() => {
        const timer = setTimeout(() => {
            updateURL();
        }, 500);
        
        return () => clearTimeout(timer);
    }, [updateURL]);

    // Effect to recalculate on input changes
    useEffect(() => {
        // FIX 3: Replaced the simple estimation with an iterative calculation for better accuracy
        const calculateAffordability = (totalDownPayment) => {
            if (desiredMonthlyPayment <= 0 || interestRate <= 0 || loanTerm <= 0 || !isFinite(desiredMonthlyPayment) || !isFinite(interestRate) || !isFinite(loanTerm)) {
                return { maxLoan: 0, maxPropertyPrice: totalDownPayment };
            }

            const monthlyInterestRate = interestRate / 100 / 12;
            const numberOfPayments = loanTerm * 12;

            let estimatedPropertyValue = desiredMonthlyPayment * 200; // Start with a rough guess
            let maxLoan = 0;

            // Iterate a few times to find a stable property value
            for (let i = 0; i < 10; i++) {
                const estimatedPropertyTax = calculatePropertyTax(estimatedPropertyValue, propertyTaxMode, customPropertyTaxAmount);
                const otherCosts = (municipalDues / 12) + (homeInsurance / 12) + (estimatedPropertyTax / 12) + hoa;
                const pAndI = desiredMonthlyPayment + Number(rentalIncome) - otherCosts;

                if (pAndI <= 0) {
                    maxLoan = 0;
                    break;
                }

                if (loanType === 'annuity') {
                    maxLoan = pAndI * ((Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1) / (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)));
                } else { // Serial loan
                    maxLoan = pAndI / ((1 / numberOfPayments) + monthlyInterestRate);
                }

                const newEstimatedPropertyValue = maxLoan + totalDownPayment;
                // If the value has stabilized, break the loop
                if (Math.abs(newEstimatedPropertyValue - estimatedPropertyValue) < 1000) {
                    estimatedPropertyValue = newEstimatedPropertyValue;
                    break;
                }
                estimatedPropertyValue = newEstimatedPropertyValue;
            }

            maxLoan = maxLoan > 0 ? maxLoan : 0;
            return { maxLoan, maxPropertyPrice: maxLoan + totalDownPayment };
        };

        const calculateLoanDetails = (amount) => {
            if (amount <= 0) return { firstMonthPayment: 0, totalInterestPaid: 0, amortization: [] };

            const monthlyInterestRate = interestRate / 100 / 12;
            const numberOfPayments = loanTerm * 12;

            let balance = amount;
            const amortization = [];
            let totalInterestPaid = 0;
            let firstMonthPayment = 0;

            if (loanType === 'annuity') {
                const M = amount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) / (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);
                firstMonthPayment = M;
                for (let i = 1; i <= numberOfPayments; i++) {
                    if (balance <= 0) break;
                    const interestPayment = balance * monthlyInterestRate;
                    const principalPayment = M - interestPayment;
                    balance -= principalPayment;
                    totalInterestPaid += interestPayment;
                    amortization.push({ month: i, principal: principalPayment, interest: interestPayment, balance: balance < 0 ? 0 : balance, totalPayment: M });
                }
            } else { // Serial Loan
                const principalPerMonth = amount / numberOfPayments;
                for (let i = 1; i <= numberOfPayments; i++) {
                    if (balance <= 0) break;
                    const interestPayment = balance * monthlyInterestRate;
                    const totalPaymentThisMonth = principalPerMonth + interestPayment;
                    if (i === 1) firstMonthPayment = totalPaymentThisMonth;
                    balance -= principalPerMonth;
                    totalInterestPaid += interestPayment;
                    amortization.push({ month: i, principal: principalPerMonth, interest: interestPayment, balance: balance < 0 ? 0 : balance, totalPayment: totalPaymentThisMonth });
                }
            }
            return { firstMonthPayment, totalInterestPaid, amortization };
        };

        const totalDownPayment = downPayment1 + downPayment2;
        let currentPropertyValue = 0;

        if (calculationMode === 'byPayment') {
            const { maxPropertyPrice } = calculateAffordability(totalDownPayment);
            currentPropertyValue = maxPropertyPrice;
        } else { // 'byPrice'
            currentPropertyValue = propertyValue;
        }

        setFinalPropertyValue(currentPropertyValue);

        const ownershipValue1 = currentPropertyValue * (ownershipSplit / 100);
        const ownershipValue2 = currentPropertyValue * ((100 - ownershipSplit) / 100);

        const finalLoan1 = Math.max(0, ownershipValue1 - downPayment1);
        const finalLoan2 = Math.max(0, ownershipValue2 - downPayment2);

        const totalLoanAmount = finalLoan1 + finalLoan2;
        setLoanAmount(totalLoanAmount);

        if (totalLoanAmount <= 0) {
            setCalculatedMonthlyPayment(0);
            setLoanDetails1({ amount: 0, payment: 0, amortization: [], annuityPayment: 0, serialFirstPayment: 0, serialLastPayment: 0 });
            setLoanDetails2({ amount: 0, payment: 0, amortization: [], annuityPayment: 0, serialFirstPayment: 0, serialLastPayment: 0 });
            setTotalInterest(0);
            setAmortizationData([]);
        } else {
            const details1 = calculateLoanDetails(finalLoan1);
            const details2 = calculateLoanDetails(finalLoan2);

            // Calculate payments for both loan types for each person
            const monthlyRate = interestRate / 100 / 12;
            const numPayments = loanTerm * 12;
            
            // Person 1 calculations
            let annuityPayment1 = 0;
            let serialFirstPayment1 = 0;
            let serialLastPayment1 = 0;
            
            if (finalLoan1 > 0) {
                // Annuity
                annuityPayment1 = finalLoan1 * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
                // Serial
                const serialPrincipal1 = finalLoan1 / numPayments;
                serialFirstPayment1 = serialPrincipal1 + (finalLoan1 * monthlyRate);
                serialLastPayment1 = serialPrincipal1 + (serialPrincipal1 * monthlyRate);
            }
            
            // Person 2 calculations
            let annuityPayment2 = 0;
            let serialFirstPayment2 = 0;
            let serialLastPayment2 = 0;
            
            if (finalLoan2 > 0) {
                // Annuity
                annuityPayment2 = finalLoan2 * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
                // Serial
                const serialPrincipal2 = finalLoan2 / numPayments;
                serialFirstPayment2 = serialPrincipal2 + (finalLoan2 * monthlyRate);
                serialLastPayment2 = serialPrincipal2 + (serialPrincipal2 * monthlyRate);
            }
            
            setLoanDetails1({ 
                amount: finalLoan1, 
                payment: details1.firstMonthPayment, 
                amortization: details1.amortization,
                annuityPayment: annuityPayment1,
                serialFirstPayment: serialFirstPayment1,
                serialLastPayment: serialLastPayment1
            });
            setLoanDetails2({ 
                amount: finalLoan2, 
                payment: details2.firstMonthPayment, 
                amortization: details2.amortization,
                annuityPayment: annuityPayment2,
                serialFirstPayment: serialFirstPayment2,
                serialLastPayment: serialLastPayment2
            });
            setTotalInterest(details1.totalInterestPaid + details2.totalInterestPaid);
            setCalculatedMonthlyPayment(details1.firstMonthPayment + details2.firstMonthPayment);

            // FIX 1: Create a combined amortization schedule that correctly reflects two separate loans
            const correctCombinedAmortization = [];
            const numberOfPayments = loanTerm * 12;
            for (let i = 0; i < numberOfPayments; i++) {
                const monthData1 = details1.amortization[i] || { balance: 0, principal: 0, interest: 0, totalPayment: 0 };
                const monthData2 = details2.amortization[i] || { balance: 0, principal: 0, interest: 0, totalPayment: 0 };

                correctCombinedAmortization.push({
                    month: i + 1,
                    balance: monthData1.balance + monthData2.balance,
                    principal: monthData1.principal + monthData2.principal,
                    interest: monthData1.interest + monthData2.interest,
                    totalPayment: monthData1.totalPayment + monthData2.totalPayment,
                });
            }
            setAmortizationData(correctCombinedAmortization);
        }

        const calculatedPropertyTax = calculatePropertyTax(currentPropertyValue, propertyTaxMode, customPropertyTaxAmount);
        setPropertyTax(calculatedPropertyTax);

    }, [calculationMode, desiredMonthlyPayment, propertyValue, interestRate, loanTerm, downPayment1, downPayment2, municipalDues, homeInsurance, hoa, maintenance, annualAppreciation, requiredReturn, rentalIncome, loanType, ownershipSplit, propertyTaxMode, customPropertyTaxAmount]);

    useEffect(() => {
        const monthlyFixedCosts = (municipalDues / 12) + (homeInsurance / 12) + (propertyTax / 12) + (maintenance / 12) + hoa;
        const totalCost = calculatedMonthlyPayment + monthlyFixedCosts;
        setTotalMonthlyCost(totalCost);
        setNetMonthlyCost(totalCost - rentalIncome);

        if (loanAmount > 0 && amortizationData.length > 0) {
            const payoff = new Date();
            payoff.setMonth(payoff.getMonth() + amortizationData.length);
            setPayoffDate(payoff.toLocaleDateString('nb-NO', { year: 'numeric', month: 'long' }));
        } else {
            setPayoffDate('N/A');
        }

    }, [calculatedMonthlyPayment, municipalDues, homeInsurance, hoa, maintenance, rentalIncome, loanAmount, amortizationData, propertyTax]);

    const totalDownPayment = downPayment1 + downPayment2;
    const downPaymentPercentage1 = totalDownPayment > 0 ? (downPayment1 / totalDownPayment) * 100 : 0;
    const downPaymentPercentage2 = totalDownPayment > 0 ? (downPayment2 / totalDownPayment) * 100 : 0;

    const yearsToPayoff = amortizationData.length > 0 ? amortizationData.length / 12 : loanTerm;
    const futurePropertyValue = finalPropertyValue * Math.pow(1 + (annualAppreciation / 100), yearsToPayoff);

    // Loan Type Comparison Calculation (moved here to avoid use-before-define)
    const loanTypeComparison = useMemo(() => {
        if (loanAmount <= 0) return null;
        
        const monthlyInterestRate = interestRate / 100 / 12;
        const numberOfPayments = loanTerm * 12;
        
        // Calculate for Annuity loan
        const annuityPayment = loanAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) / (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);
        let annuityTotalInterest = 0;
        let annuityBalance = loanAmount;
        const annuityMonthlyPayments = [];
        
        for (let i = 1; i <= numberOfPayments; i++) {
            const interestPayment = annuityBalance * monthlyInterestRate;
            const principalPayment = annuityPayment - interestPayment;
            annuityBalance -= principalPayment;
            annuityTotalInterest += interestPayment;
            if (i === 1 || i === Math.floor(numberOfPayments/2) || i === numberOfPayments) {
                annuityMonthlyPayments.push({ month: i, payment: annuityPayment, principal: principalPayment, interest: interestPayment });
            }
        }
        
        // Calculate for Serial loan
        const serialPrincipalPayment = loanAmount / numberOfPayments;
        let serialTotalInterest = 0;
        let serialBalance = loanAmount;
        const serialMonthlyPayments = [];
        
        for (let i = 1; i <= numberOfPayments; i++) {
            const interestPayment = serialBalance * monthlyInterestRate;
            const totalPayment = serialPrincipalPayment + interestPayment;
            serialBalance -= serialPrincipalPayment;
            serialTotalInterest += interestPayment;
            if (i === 1 || i === Math.floor(numberOfPayments/2) || i === numberOfPayments) {
                serialMonthlyPayments.push({ month: i, payment: totalPayment, principal: serialPrincipalPayment, interest: interestPayment });
            }
        }
        
        return {
            annuity: {
                totalInterest: annuityTotalInterest,
                totalCost: loanAmount + annuityTotalInterest,
                firstPayment: annuityPayment,
                lastPayment: annuityPayment,
                monthlyPayments: annuityMonthlyPayments
            },
            serial: {
                totalInterest: serialTotalInterest,
                totalCost: loanAmount + serialTotalInterest,
                firstPayment: serialPrincipalPayment + (loanAmount * monthlyInterestRate),
                lastPayment: serialPrincipalPayment + (serialPrincipalPayment * monthlyInterestRate),
                monthlyPayments: serialMonthlyPayments
            }
        };
    }, [loanAmount, interestRate, loanTerm]);

    // FIX 2: Complete rewrite of NPV and related financial metrics for correctness
    const calculateAdvancedMetrics = useMemo(() => {
        if (yearsToPayoff <= 0 || !amortizationData || amortizationData.length === 0) {
            return { netPresentValue: 0, returnOnEquity: 0, totalPropertyReturn: 0, totalAlternativeReturn: 0, investmentAdvantage: 0, presentValueOfPropertyInvestment: 0, presentValueOfFutureSale: 0, presentValueOfRentalIncome: 0, presentValueOfCosts: 0, remainingDebt: 0, netWorthWithProperty: 0, realPropertyGain: 0, pureAlternativeReturn: 0, pureInvestmentAdvantage: 0, totalPaidIn: 0, classicRentVsBuyAdvantage: 0, totalRentVsBuyWealth: 0 };
        }

        const annualCosts = municipalDues + homeInsurance + propertyTax + maintenance + (hoa * 12);
        const annualRentalIncome = rentalIncome * 12;

        let presentValueOfAllCashFlows = 0;
        for (let year = 1; year <= yearsToPayoff; year++) {
            const startMonth = (year - 1) * 12;
            const endMonth = year * 12;
            const annualLoanPayment = amortizationData.slice(startMonth, endMonth).reduce((sum, month) => sum + month.totalPayment, 0);

            const netCashFlowForYear = annualRentalIncome - annualCosts - annualLoanPayment;

            presentValueOfAllCashFlows += netCashFlowForYear / Math.pow(1 + (requiredReturn / 100), year);
        }

        const presentValueOfFutureSale = futurePropertyValue / Math.pow(1 + (requiredReturn / 100), yearsToPayoff);
        const netPresentValue = presentValueOfAllCashFlows + presentValueOfFutureSale - totalDownPayment;

        const totalOtherCostsPaid = (annualCosts - annualRentalIncome) * yearsToPayoff;
        const netProfit = futurePropertyValue - totalDownPayment - totalInterest - totalOtherCostsPaid;
        const returnOnEquity = totalDownPayment > 0
            ? (Math.pow((totalDownPayment + netProfit) / totalDownPayment, 1 / yearsToPayoff) - 1) * 100
            : 0;

        // Beregn restgjeld etter X år
        const remainingDebt = amortizationData.length > 0 && amortizationData[amortizationData.length - 1] 
            ? amortizationData[amortizationData.length - 1].balance 
            : 0;
        
        // Netto formue fra boligkjøp = Boligverdi - Restgjeld
        const netWorthWithProperty = futurePropertyValue - remainingDebt;
        
        // Hva har du faktisk betalt inn over årene?
        const totalPaidIn = totalDownPayment + totalInterest + (loanAmount - remainingDebt) + 
                           ((municipalDues + homeInsurance + propertyTax + maintenance + (hoa * 12)) * yearsToPayoff) -
                           (rentalIncome * 12 * yearsToPayoff);
        
        // Din reelle gevinst fra boligkjøp
        const realPropertyGain = netWorthWithProperty - totalPaidIn;
        
        // Beregn separate verdier for annuitetslån og serielån
        let totalPaidInAnnuity = totalPaidIn;
        let totalPaidInSerial = totalPaidIn;
        let realPropertyGainAnnuity = realPropertyGain;
        let realPropertyGainSerial = realPropertyGain;
        
        if (loanTypeComparison) {
            // For annuitetslån
            totalPaidInAnnuity = totalDownPayment + loanTypeComparison.annuity.totalInterest + (loanAmount - remainingDebt) + 
                               ((municipalDues + homeInsurance + propertyTax + maintenance + (hoa * 12)) * yearsToPayoff) -
                               (rentalIncome * 12 * yearsToPayoff);
            realPropertyGainAnnuity = netWorthWithProperty - totalPaidInAnnuity;
            
            // For serielån
            totalPaidInSerial = totalDownPayment + loanTypeComparison.serial.totalInterest + (loanAmount - remainingDebt) + 
                              ((municipalDues + homeInsurance + propertyTax + maintenance + (hoa * 12)) * yearsToPayoff) -
                              (rentalIncome * 12 * yearsToPayoff);
            realPropertyGainSerial = netWorthWithProperty - totalPaidInSerial;
        }
        
        // Ren investeringssammenligning - kun egenkapital
        const pureAlternativeReturn = totalDownPayment * Math.pow(1 + (requiredReturn / 100), yearsToPayoff);
        const pureInvestmentAdvantage = realPropertyGain - (pureAlternativeReturn - totalDownPayment);
        
        // Alternativ: Hvis du hadde spart samme månedlige beløp
        // Start med egenkapital, legg til månedlig sparing med rente
        const monthlyTotalCost = calculatedMonthlyPayment + (municipalDues/12) + (homeInsurance/12) + 
                                (propertyTax/12) + (maintenance/12) + hoa - rentalIncome;
        
        // Beregn fremtidig verdi av månedlig sparing (annuitet)
        const r = requiredReturn / 100 / 12; // månedlig rente
        const n = yearsToPayoff * 12; // antall måneder
        const futureValueOfMonthlySavings = r > 0 ? monthlyTotalCost * ((Math.pow(1 + r, n) - 1) / r) : monthlyTotalCost * n;
        
        // Total alternativ formue = egenkapital med rente + månedlig sparing med rente
        const totalAlternativeWealth = totalDownPayment * Math.pow(1 + (requiredReturn / 100), yearsToPayoff) + futureValueOfMonthlySavings;
        
        // Sammenlign formue
        const totalPropertyReturn = netWorthWithProperty;
        const totalAlternativeReturn = totalAlternativeWealth;
        const investmentAdvantage = totalPropertyReturn - totalAlternativeReturn;

        // Separate present value components for detailed breakdown
        let presentValueOfCosts = 0;
        let presentValueOfRentalIncome = 0;
        
        for (let year = 1; year <= yearsToPayoff; year++) {
            const startMonth = (year - 1) * 12;
            const endMonth = year * 12;
            const annualLoanPayment = amortizationData.slice(startMonth, endMonth).reduce((sum, month) => sum + month.totalPayment, 0);
            const totalAnnualCosts = annualCosts + annualLoanPayment;
            
            presentValueOfCosts += totalAnnualCosts / Math.pow(1 + (requiredReturn / 100), year);
            presentValueOfRentalIncome += annualRentalIncome / Math.pow(1 + (requiredReturn / 100), year);
        }

        // Present value comparisons - what both investments are worth in today's money
        const presentValueOfPropertyInvestment = presentValueOfAllCashFlows + presentValueOfFutureSale;

        // Klassisk leie vs kjøpe sammenligning
        // Hvis du leier til alternativeRentCost per måned og investerer differansen
        const monthlySavingsIfRenting = totalMonthlyCost - alternativeRentCost; // Hva du sparer per måned ved å leie
        
        // Beregn formue hvis du leier og investerer differansen
        let totalRentVsBuyWealth = totalDownPayment * Math.pow(1 + (requiredReturn / 100), yearsToPayoff); // Egenkapital investert
        
        // Hvis du sparer penger ved å leie (dvs. leie er billigere enn å eie)
        if (monthlySavingsIfRenting > 0) {
            const r = requiredReturn / 100 / 12;
            const n = yearsToPayoff * 12;
            const futureValueOfSavings = r > 0 ? monthlySavingsIfRenting * ((Math.pow(1 + r, n) - 1) / r) : monthlySavingsIfRenting * n;
            totalRentVsBuyWealth += futureValueOfSavings;
        }
        
        const classicRentVsBuyAdvantage = netWorthWithProperty - totalRentVsBuyWealth;

        return { 
            netPresentValue, 
            returnOnEquity, 
            totalPropertyReturn, 
            totalAlternativeReturn, 
            investmentAdvantage,
            presentValueOfPropertyInvestment,
            presentValueOfFutureSale,
            presentValueOfRentalIncome,
            presentValueOfCosts,
            remainingDebt,
            netWorthWithProperty,
            realPropertyGain,
            pureAlternativeReturn,
            pureInvestmentAdvantage,
            totalPaidIn,
            classicRentVsBuyAdvantage,
            totalRentVsBuyWealth,
            totalPaidInAnnuity,
            totalPaidInSerial,
            realPropertyGainAnnuity,
            realPropertyGainSerial
        };
    }, [yearsToPayoff, amortizationData, municipalDues, homeInsurance, propertyTax, maintenance, hoa, rentalIncome, requiredReturn, futurePropertyValue, totalDownPayment, totalInterest, loanAmount, calculatedMonthlyPayment, totalMonthlyCost, alternativeRentCost, loanTypeComparison]);

    const { 
        totalPropertyReturn, 
        totalAlternativeReturn, 
        investmentAdvantage,
        presentValueOfFutureSale,
        presentValueOfRentalIncome,
        remainingDebt,
        realPropertyGain,
        pureAlternativeReturn,
        pureInvestmentAdvantage,
        totalPaidIn,
        classicRentVsBuyAdvantage,
        totalRentVsBuyWealth,
        totalPaidInAnnuity,
        totalPaidInSerial,
        realPropertyGainAnnuity,
        realPropertyGainSerial
    } = calculateAdvancedMetrics;

    // Chart Data
    const amortizationChartData = {
        labels: amortizationData.map(d => `Måned ${d.month}`),
        datasets: [{ label: 'Gjenværende Lånebalanse', data: amortizationData.map(d => d.balance), borderColor: 'rgb(75, 192, 192)', backgroundColor: 'rgba(75, 192, 192, 0.2)', fill: true, tension: 0.1, }],
    };
    // Calculate percentages for payment breakdown
    const paymentBreakdownData = [
        { label: 'Avdrag & Renter', value: calculatedMonthlyPayment },
        { label: 'Kommunale Avgifter', value: municipalDues / 12 },
        { label: 'Eiendomsskatt', value: propertyTax / 12 },
        { label: 'Boligforsikring', value: homeInsurance / 12 },
        { label: 'Vedlikehold', value: maintenance / 12 },
        { label: 'Felleskostnader', value: hoa }
    ].filter(item => item.value > 0);
    
    const totalPaymentBreakdown = paymentBreakdownData.reduce((sum, item) => sum + item.value, 0);
    
    const paymentBreakdownChartData = {
        labels: paymentBreakdownData.map(item => 
            `${item.label} (${((item.value / totalPaymentBreakdown) * 100).toFixed(1)}%)`
        ),
        datasets: [{ 
            data: paymentBreakdownData.map(item => item.value), 
            backgroundColor: ['#4CAF50', '#FFC107', '#FF5722', '#9C27B0', '#FF9800', '#2196F3'], 
            hoverBackgroundColor: ['#66BB6A', '#FFCA28', '#FF7043', '#BA68C8', '#FFB74D', '#42A5F5'],
        }],
    };
    
    // Calculate principal vs interest for first payment
    const firstPaymentPrincipal = amortizationData.length > 0 ? amortizationData[0].principal : 0;
    const firstPaymentInterest = amortizationData.length > 0 ? amortizationData[0].interest : 0;
    const principalPercentage = calculatedMonthlyPayment > 0 ? ((firstPaymentPrincipal / calculatedMonthlyPayment) * 100).toFixed(1) : 0;
    const interestPercentage = calculatedMonthlyPayment > 0 ? ((firstPaymentInterest / calculatedMonthlyPayment) * 100).toFixed(1) : 0;

    return (
        <div className="bg-gray-100 min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 text-center">
                    <h1 className="text-4xl font-bold text-gray-800">Avansert Lånekalkulator</h1>
                    <p className="text-lg text-gray-600 mt-2">Se hva dere har råd til og hvordan kostnadene fordeles.</p>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            alert('Link kopiert til utklippstavlen!');
                        }}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        🔗 Kopier link med innstillinger
                    </button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-3">Kalkuleringsmåte</h2>
                        <div className="flex flex-col sm:flex-row rounded-md shadow-sm mb-6 gap-2 sm:gap-0">
                            <button onClick={() => setCalculationMode('byPayment')} className={`flex-1 p-3 sm:p-2 text-sm sm:rounded-l-md rounded-md ${calculationMode === 'byPayment' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Finn boligpris fra månedsbeløp</button>
                            <button onClick={() => setCalculationMode('byPrice')} className={`flex-1 p-3 sm:p-2 text-sm sm:rounded-r-md rounded-md ${calculationMode === 'byPrice' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Finn månedsbeløp fra boligpris</button>
                        </div>

                        {calculationMode === 'byPayment' ? (
                            <div>
                                <InputSlider label="Ønsket Månedlig Betaling (Totalt)" value={desiredMonthlyPayment} onChange={e => setDesiredMonthlyPayment(Number(e.target.value))} min={1000} max={100000} step={1000} format="currency" />
                            </div>
                        ) : (
                            <div>
                                <InputSlider label="Ønsket Boligpris" value={propertyValue} onChange={e => setPropertyValue(Number(e.target.value))} min={500000} max={30000000} step={50000} format="currency" />
                            </div>
                        )}

                        <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-4 border-b pb-2">Fordeling</h3>
                        <InputSlider label="Din Egenkapital" value={downPayment1} onChange={e => setDownPayment1(Number(e.target.value))} min={0} max={17500000} step={10000} format="currency" />
                        <InputSlider label="Medlåntakers Egenkapital" value={downPayment2} onChange={e => setDownPayment2(Number(e.target.value))} min={0} max={17500000} step={10000} format="currency" />
                        <InputSlider label="Ønsket Eierandel (Din andel %)" value={ownershipSplit} onChange={e => setOwnershipSplit(Number(e.target.value))} min={0} max={100} step={1} format="percent" />

                        <h3 className="text-xl font-semibold text-gray-700 mt-8 mb-4 border-b pb-2">Lånebetingelser</h3>
                        <InputSlider label="Rente (%)" value={interestRate} onChange={e => setInterestRate(Number(e.target.value))} min={0.1} max={20} step={0.01} format="percent" />
                        <InputSlider label="Løpetid (År)" value={loanTerm} onChange={e => setLoanTerm(Number(e.target.value))} min={1} max={40} step={1} format="years" />
        
                        {calculationMode === 'byPayment' ? (
                            <div className="mt-6 pt-6 border-t bg-blue-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-gray-700 mb-2">Resultat:</h4>
                                <SummaryBox label="Maksimal Boligpris" value={finalPropertyValue} format="currency" color="text-purple-600" isLarge={true} />
                                <SummaryBox label="Månedlig Betaling" value={calculatedMonthlyPayment} format="currency" color="text-purple-600" isLarge={true} />
                                <SummaryBox label="Tilhørende Lånebeløp" value={loanAmount} format="currency" color="text-indigo-600" isLarge={true} />
                            </div>
                        ) : (
                            <div className="mt-6 pt-6 border-t bg-blue-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-gray-700 mb-2">Resultat:</h4>
                                <SummaryBox label="Månedlig Betaling" value={calculatedMonthlyPayment} format="currency" color="text-purple-600" isLarge={true} />
                                <SummaryBox label="Nødvendig Lånebeløp" value={loanAmount} format="currency" color="text-indigo-600" isLarge={true} />
                            </div>
                        )}

                        <h3 className="text-xl font-semibold text-gray-700 mt-8 mb-4 border-b pb-2">Faste Kostnader & Inntekt</h3>
                        <InputSlider label="Kommunale Avgifter (kr/år)" value={municipalDues} onChange={e => setMunicipalDues(Number(e.target.value))} min={0} max={100000} step={1000} format="currency" />
                        <InputSlider label="Vedlikehold (kr/år)" value={maintenance} onChange={e => setMaintenance(Number(e.target.value))} min={0} max={100000} step={1000} format="currency" />
                        <InputSlider label="Boligforsikring (kr/år)" value={homeInsurance} onChange={e => setHomeInsurance(Number(e.target.value))} min={0} max={50000} step={500} format="currency" />
                        <InputSlider label="Felleskostnader (kr/mnd)" value={hoa} onChange={e => setHoa(Number(e.target.value))} min={0} max={20000} step={250} format="currency" />
                        <InputSlider label="Forventet prisendring (% per år)" value={annualAppreciation} onChange={e => setAnnualAppreciation(Number(e.target.value))} min={-10} max={15} step={0.1} format="percent" />
                        <InputSlider label="Avkastningskrav (% per år)" value={requiredReturn} onChange={e => setRequiredReturn(Number(e.target.value))} min={1} max={15} step={0.1} format="percent" />
                        <InputSlider label="Utleieinntekt (kr/mnd)" value={rentalIncome} onChange={e => setRentalIncome(Number(e.target.value))} min={0} max={30000} step={500} format="currency" />

                        <h3 className="text-xl font-semibold text-gray-700 mt-8 mb-4 border-b pb-2">Eiendomsskatt</h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Kommune</label>
                            <div className="flex rounded-md shadow-sm mb-4">
                                <button onClick={() => setPropertyTaxMode('oslo')} className={`flex-1 p-2 text-sm rounded-l-md ${propertyTaxMode === 'oslo' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Oslo (2,35‰)</button>
                                <button onClick={() => setPropertyTaxMode('custom')} className={`flex-1 p-2 text-sm rounded-r-md ${propertyTaxMode === 'custom' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Annen kommune</button>
                            </div>
                        </div>
                        {propertyTaxMode === 'custom' && (
                            <InputSlider label="Årlig eiendomsskatt (kr)" value={customPropertyTaxAmount} onChange={e => setCustomPropertyTaxAmount(Number(e.target.value))} min={0} max={100000} step={1000} format="currency" />
                        )}
                        <div className="bg-gray-100 p-3 rounded-lg">
                            <p className="text-sm text-gray-600">Beregnet årlig eiendomsskatt</p>
                            <p className="font-bold text-lg text-gray-800">{formatCurrency(propertyTax)}</p>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white p-6 rounded-xl shadow-lg">
                            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Individuell Fordeling</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-bold text-lg text-gray-800 mb-3">Låntaker 1 (Deg)</h3>
                                    <div className="space-y-2 mb-4">
                                        <p className="text-sm text-gray-600">Egenkapital: <span className="font-semibold">{formatCurrency(downPayment1)} ({downPaymentPercentage1.toFixed(0)}%)</span></p>
                                        <p className="text-sm text-gray-600">Eierandel: <span className="font-semibold">{ownershipSplit}%</span></p>
                                        <p className="text-sm text-gray-700 font-semibold">Lånebeløp: {formatCurrency(loanDetails1.amount)}</p>
                                    </div>
                                    
                                    <div className="border-t pt-3">
                                        <p className="text-sm font-medium text-gray-700 mb-2">Månedlige betalinger:</p>
                                        <div className="space-y-2">
                                            <div className="bg-blue-50 p-2 rounded border-l-4 border-blue-400">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-700">Annuitetslån {loanType === 'annuity' ? '(✓)' : ''}</span>
                                                    <span className="font-semibold text-blue-700">{formatCurrency(Math.round(loanDetails1.annuityPayment))}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">Fast betaling</p>
                                            </div>
                                            <div className="bg-green-50 p-2 rounded border-l-4 border-green-400">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-700">Serielån {loanType === 'serial' ? '(✓)' : ''}</span>
                                                    <span className="font-semibold text-green-700">{formatCurrency(Math.round(loanDetails1.serialFirstPayment))}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">Første: {formatCurrency(Math.round(loanDetails1.serialFirstPayment))} → Siste: {formatCurrency(Math.round(loanDetails1.serialLastPayment))}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-bold text-lg text-gray-800 mb-3">Låntaker 2</h3>
                                    <div className="space-y-2 mb-4">
                                        <p className="text-sm text-gray-600">Egenkapital: <span className="font-semibold">{formatCurrency(downPayment2)} ({downPaymentPercentage2.toFixed(0)}%)</span></p>
                                        <p className="text-sm text-gray-600">Eierandel: <span className="font-semibold">{100 - ownershipSplit}%</span></p>
                                        <p className="text-sm text-gray-700 font-semibold">Lånebeløp: {formatCurrency(loanDetails2.amount)}</p>
                                    </div>
                                    
                                    {loanDetails2.amount > 0 ? (
                                        <div className="border-t pt-3">
                                            <p className="text-sm font-medium text-gray-700 mb-2">Månedlige betalinger:</p>
                                            <div className="space-y-2">
                                                <div className="bg-blue-50 p-2 rounded border-l-4 border-blue-400">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-gray-700">Annuitetslån {loanType === 'annuity' ? '(✓)' : ''}</span>
                                                        <span className="font-semibold text-blue-700">{formatCurrency(Math.round(loanDetails2.annuityPayment))}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">Fast betaling</p>
                                                </div>
                                                <div className="bg-green-50 p-2 rounded border-l-4 border-green-400">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-gray-700">Serielån {loanType === 'serial' ? '(✓)' : ''}</span>
                                                        <span className="font-semibold text-green-700">{formatCurrency(Math.round(loanDetails2.serialFirstPayment))}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">Første: {formatCurrency(Math.round(loanDetails2.serialFirstPayment))} → Siste: {formatCurrency(Math.round(loanDetails2.serialLastPayment))}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border-t pt-3 text-center text-gray-500 text-sm">
                                            <p>Ingen lånebehov</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                            {/* Header med gradient */}
                            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    Totalsammendrag
                                </h2>
                                <p className="text-blue-100 mt-1">Oversikt over månedlige kostnader og nøkkeltall</p>
                            </div>

                            {/* Hovedkort */}
                            <div className="p-6 bg-gray-50">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Total månedlig kostnad - fremhevet */}
                                    <div className="col-span-1 md:col-span-2 lg:col-span-1">
                                        <div className="bg-white rounded-xl p-5 border-2 border-blue-500 shadow-md">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm font-medium text-gray-600">Total månedlig</span>
                                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                                </svg>
                                            </div>
                                            
                                            {loanTypeComparison && (
                                                <>
                                                    {/* Annuitetslån */}
                                                    <div className="mb-3 pb-3 border-b border-gray-200">
                                                        <p className="text-xs text-gray-500 mb-1">Annuitetslån</p>
                                                        <p className="text-2xl font-bold text-blue-600">
                                                            {formatCurrency(Math.round(loanTypeComparison.annuity.firstPayment + (municipalDues / 12) + (propertyTax / 12) + (maintenance / 12) + (homeInsurance / 12) + hoa - rentalIncome))}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Lånebeløp: {formatCurrency(Math.round(loanTypeComparison.annuity.firstPayment))}
                                                        </p>
                                                        <p className="text-xs text-red-600 mt-1">
                                                            Total rente: {formatCurrency(Math.round(loanTypeComparison.annuity.totalInterest))}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Serielån */}
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">Serielån</p>
                                                        <p className="text-2xl font-bold text-green-600">
                                                            {formatCurrency(Math.round(loanTypeComparison.serial.firstPayment + (municipalDues / 12) + (propertyTax / 12) + (maintenance / 12) + (homeInsurance / 12) + hoa - rentalIncome))}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Første: {formatCurrency(Math.round(loanTypeComparison.serial.firstPayment))} → Siste: {formatCurrency(Math.round(loanTypeComparison.serial.lastPayment))}
                                                        </p>
                                                        <p className="text-xs text-red-600 mt-1">
                                                            Total rente: {formatCurrency(Math.round(loanTypeComparison.serial.totalInterest))}
                                                        </p>
                                                    </div>

                                                    {/* Besparelse */}
                                                    <div className="mt-3 pt-3 border-t border-gray-200 bg-green-50 -mx-2 px-2 py-2 rounded">
                                                        <p className="text-xs font-medium text-green-700">
                                                            ✓ Serielån sparer {formatCurrency(Math.round(loanTypeComparison.annuity.totalInterest - loanTypeComparison.serial.totalInterest))} i renter
                                                        </p>
                                                    </div>
                                                </>
                                            )}
                                            {!loanTypeComparison && (
                                                <p className="text-2xl font-bold text-blue-600">{formatCurrency(netMonthlyCost)}</p>
                                            )}
                                            {rentalIncome > 0 && (
                                                <p className="text-xs text-green-600 mt-2 pt-2 border-t border-gray-200">Etter utleie: -{formatCurrency(rentalIncome)}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Nedbetalingsdato */}
                                    <div className="bg-white rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-medium text-gray-600">Nedbetalingsdato</span>
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <p className="text-2xl font-bold text-gray-800">{payoffDate}</p>
                                        <p className="text-xs text-gray-500 mt-1">{loanTerm} år lånetid</p>
                                    </div>

                                    {/* Egenkapitalandel */}
                                    <div className="bg-white rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-medium text-gray-600">Egenkapitalandel</span>
                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <p className="text-2xl font-bold text-green-600">{finalPropertyValue > 0 ? `${((totalDownPayment / finalPropertyValue) * 100).toFixed(1)}%` : '0%'}</p>
                                        <div className="mt-2">
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                                                    style={{ width: finalPropertyValue > 0 ? `${((totalDownPayment / finalPropertyValue) * 100).toFixed(1)}%` : '0%' }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Nåverdi av bolig */}
                                    <div className="bg-white rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-medium text-gray-600">Nåverdi av bolig</span>
                                            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                            </svg>
                                        </div>
                                        <p className="text-2xl font-bold text-purple-600">{formatCurrency(presentValueOfFutureSale)}</p>
                                        <p className="text-xs text-gray-500 mt-1">Verdi i dagens penger</p>
                                    </div>
                                </div>

                                {/* Felleskostnader bar */}
                                <div className="mt-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                                            <span className="text-sm font-medium text-gray-700">Totale felleskostnader</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xl font-bold text-gray-800">{formatCurrency(Math.round((municipalDues / 12) + (propertyTax / 12) + (maintenance / 12) + (homeInsurance / 12) + hoa))}</span>
                                            <span className="text-sm text-gray-600">/mnd</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Fordeles etter eierandel mellom låntakerne
                                    </p>
                                </div>
                            </div>

                            {/* Kollapsbar investeringsanalyse */}
                            <div className="border-t pt-4 mt-4">
                                <button
                                    onClick={() => toggleSection('investmentAnalysis')}
                                    className="w-full flex justify-between items-center text-md font-medium text-gray-600 hover:text-gray-800 p-2 rounded hover:bg-gray-100"
                                    aria-expanded={expandedSections.investmentAnalysis}
                                >
                                    <span>💰 Investeringsanalyse</span>
                                    <span className="text-xl">{expandedSections.investmentAnalysis ? '−' : '+'}</span>
                                </button>
                                
                                {expandedSections.investmentAnalysis && (
                                    <div className="mt-4 bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200">
                                        
                                        {/* Klassisk leie vs kjøpe */}
                                        <div className="mb-6">
                                            <h5 className="text-md font-medium text-gray-700 mb-3">🏠 Klassisk situasjon: Leie vs Kjøpe</h5>
                                            <div className="mb-3">
                                                <label className="text-sm text-gray-600">Hva koster det å leie tilsvarende bolig? (kr/mnd)</label>
                                                <input
                                                    type="number"
                                                    value={alternativeRentCost}
                                                    onChange={(e) => setAlternativeRentCost(Number(e.target.value))}
                                                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="20000"
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                                <div className="bg-white p-4 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Nettoformue ved kjøp</p>
                                                    <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalPropertyReturn)}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Bolig minus gjeld etter {Math.round(yearsToPayoff)} år</p>
                                                </div>
                                                <div className="bg-white p-4 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Formue ved å leie og investere</p>
                                                    <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalRentVsBuyWealth)}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Leie {formatCurrency(alternativeRentCost)}/mnd, investere resten</p>
                                                </div>
                                            </div>
                                            <div className={`p-3 rounded-lg ${classicRentVsBuyAdvantage > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                                <p className={`text-sm ${classicRentVsBuyAdvantage > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                    {classicRentVsBuyAdvantage > 0 
                                                        ? `✓ Boligkjøp gir ${formatCurrency(classicRentVsBuyAdvantage)} høyere formue enn å leie`
                                                        : `✗ Å leie og investere gir ${formatCurrency(Math.abs(classicRentVsBuyAdvantage))} høyere formue`
                                                    }
                                                </p>
                                                {totalMonthlyCost - alternativeRentCost > 0 && (
                                                    <p className="text-xs text-gray-600 mt-1">
                                                        Ved å leie sparer du {formatCurrency(Math.round(totalMonthlyCost - alternativeRentCost))}/mnd som kan investeres
                                                    </p>
                                                )}
                                                {totalMonthlyCost - alternativeRentCost < 0 && (
                                                    <p className="text-xs text-gray-600 mt-1">
                                                        Å eie koster {formatCurrency(Math.round(Math.abs(totalMonthlyCost - alternativeRentCost)))} mer per måned enn å leie
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Sammenligning 1: Ren investering */}
                                        <div className="mb-6">
                                            <h5 className="text-md font-medium text-gray-700 mb-3">💰 Ren investeringsgevinst</h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                                <div className="bg-white p-4 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Gevinst fra boligkjøp</p>
                                                    <p className="text-2xl font-bold text-gray-800">{formatCurrency(realPropertyGain)}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Boligverdi minus alt du har betalt ({formatCurrency(totalPaidIn)})</p>
                                                </div>
                                                <div className="bg-white p-4 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Gevinst fra å investere egenkapital ({requiredReturn}%)</p>
                                                    <p className="text-2xl font-bold text-gray-800">{formatCurrency(pureAlternativeReturn - totalDownPayment)}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Kun {formatCurrency(totalDownPayment)} investert</p>
                                                </div>
                                            </div>
                                            <div className={`p-3 rounded-lg ${pureInvestmentAdvantage > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                                <p className={`text-sm ${pureInvestmentAdvantage > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                    {pureInvestmentAdvantage > 0 
                                                        ? `✓ Boligkjøpet gir ${formatCurrency(pureInvestmentAdvantage)} høyere gevinst`
                                                        : `✗ Investering gir ${formatCurrency(Math.abs(pureInvestmentAdvantage))} høyere gevinst`
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {/* Sammenligning 2: Total formue */}
                                        <div className="mb-6">
                                            <h5 className="text-md font-medium text-gray-700 mb-3">🏦 Total formue (hvis du sparer alt)</h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                                <div className="bg-white p-4 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Nettoformue med bolig</p>
                                                    <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalPropertyReturn)}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Boligverdi ({formatCurrency(futurePropertyValue)}) - Restgjeld ({formatCurrency(remainingDebt)})</p>
                                                </div>
                                                <div className="bg-white p-4 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Formue hvis du sparte {formatCurrency(Math.round(calculatedMonthlyPayment + (municipalDues/12) + (homeInsurance/12) + (propertyTax/12) + (maintenance/12) + hoa))}/mnd</p>
                                                    <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalAlternativeReturn)}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Med {requiredReturn}% årlig avkastning</p>
                                                </div>
                                            </div>
                                            <div className={`p-3 rounded-lg ${investmentAdvantage > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                                <p className={`text-sm ${investmentAdvantage > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                    {investmentAdvantage > 0 
                                                        ? `✓ Boligkjøpet gir ${formatCurrency(investmentAdvantage)} høyere formue`
                                                        : `✗ Sparing gir ${formatCurrency(Math.abs(investmentAdvantage))} høyere formue`
                                                    }
                                                </p>
                                            </div>
                                        </div>

                                        {/* Detaljerte metrics */}
                                        <div className="border-t pt-4">
                                            <p className="text-sm text-gray-600 mb-3">Detaljerte beregninger:</p>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                <SummaryBox
                                                    label="Total investert"
                                                    value={totalPaidIn}
                                                    format="currency"
                                                    tooltip="Alt du har betalt inn over perioden"
                                                />
                                                <SummaryBox
                                                    label={`Boligverdi etter ${Math.round(yearsToPayoff)} år`}
                                                    value={futurePropertyValue}
                                                    format="currency"
                                                />
                                                <SummaryBox
                                                    label="Reell gevinst"
                                                    value={realPropertyGain}
                                                    format="currency"
                                                    color={realPropertyGain > 0 ? "text-green-600" : "text-red-600"}
                                                    tooltip="Boligverdi minus alt du har betalt"
                                                />
                                                {rentalIncome > 0 && (
                                                    <SummaryBox
                                                        label="Nåverdi av utleieinntekter"
                                                        value={presentValueOfRentalIncome}
                                                        format="currency"
                                                        tooltip="Hva fremtidige leieinntekter er verdt i dag"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>


                        {/* Kostnader vs Verdi - Forenklet */}
                        <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
                            <h2 className="text-2xl font-semibold text-gray-700 mb-6">💸 Kostnader vs 📈 Gevinst</h2>
                            {loanTypeComparison ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Total lånekostnad */}
                                    <div className="bg-red-50 p-5 rounded-lg border border-red-200">
                                        <h3 className="text-lg font-semibold text-red-700 mb-4">💸 Total Lånekostnad</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-sm font-medium text-gray-700">Annuitetslån</span>
                                                    <span className="text-2xl font-bold text-red-600">
                                                        {formatCurrency(Math.round(loanAmount + loanTypeComparison.annuity.totalInterest))}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500">Lånebeløp + renter</p>
                                            </div>
                                            
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-sm font-medium text-gray-700">Serielån</span>
                                                    <span className="text-2xl font-bold text-red-600">
                                                        {formatCurrency(Math.round(loanAmount + loanTypeComparison.serial.totalInterest))}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500">Lånebeløp + renter</p>
                                            </div>
                                            
                                            <div className="pt-3 border-t border-red-200">
                                                <div className="bg-green-50 p-3 rounded-lg">
                                                    <p className="text-sm font-medium text-green-700">
                                                        ✓ Serielån sparer {formatCurrency(Math.round(loanTypeComparison.annuity.totalInterest - loanTypeComparison.serial.totalInterest))}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Netto gevinst på egenkapital */}
                                    <div className="bg-green-50 p-5 rounded-lg border border-green-200">
                                        <h3 className="text-lg font-semibold text-green-700 mb-4">📈 Netto Gevinst</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-sm font-medium text-gray-700">Annuitetslån</span>
                                                    <span className={`text-2xl font-bold ${realPropertyGainAnnuity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {realPropertyGainAnnuity > 0 ? '+' : ''}{formatCurrency(Math.round(realPropertyGainAnnuity))}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500">Boligverdi - alle kostnader</p>
                                            </div>
                                            
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-sm font-medium text-gray-700">Serielån</span>
                                                    <span className={`text-2xl font-bold ${realPropertyGainSerial > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {realPropertyGainSerial > 0 ? '+' : ''}{formatCurrency(Math.round(realPropertyGainSerial))}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500">Boligverdi - alle kostnader</p>
                                            </div>
                                            
                                            <div className="pt-3 border-t border-green-200">
                                                <div className={`${realPropertyGainSerial > realPropertyGainAnnuity ? 'bg-green-50' : 'bg-yellow-50'} p-3 rounded-lg`}>
                                                    <p className="text-sm font-medium text-gray-700">
                                                        {realPropertyGainSerial > realPropertyGainAnnuity 
                                                            ? `✓ Serielån gir ${formatCurrency(Math.round(realPropertyGainSerial - realPropertyGainAnnuity))} høyere gevinst`
                                                            : `Annuitetslån gir ${formatCurrency(Math.round(realPropertyGainAnnuity - realPropertyGainSerial))} høyere gevinst`
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    <p>Ingen lånedata tilgjengelig</p>
                                </div>
                            )}
                            
                            {/* Summary bar */}
                            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                                {loanTypeComparison ? (
                                    <div className="space-y-3">
                                        {/* Annuitetslån */}
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-xs text-gray-600">Annuitetslån</p>
                                                <p className="text-sm text-gray-600">Total investering</p>
                                                <p className="text-base font-bold text-gray-800">{formatCurrency(totalPaidInAnnuity)}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xl">→</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm text-gray-600">Boligverdi etter {loanTerm} år</p>
                                                <p className="text-base font-bold text-green-700">{formatCurrency(futurePropertyValue)}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xl">=</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-gray-600">Gevinst/tap</p>
                                                <p className={`text-lg font-bold ${realPropertyGainAnnuity > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                    {realPropertyGainAnnuity > 0 ? '+' : ''}{formatCurrency(realPropertyGainAnnuity)}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {/* Serielån */}
                                        <div className="flex justify-between items-center border-t pt-3">
                                            <div>
                                                <p className="text-xs text-gray-600">Serielån</p>
                                                <p className="text-sm text-gray-600">Total investering</p>
                                                <p className="text-base font-bold text-gray-800">{formatCurrency(totalPaidInSerial)}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xl">→</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm text-gray-600">Boligverdi etter {loanTerm} år</p>
                                                <p className="text-base font-bold text-green-700">{formatCurrency(futurePropertyValue)}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xl">=</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-gray-600">Gevinst/tap</p>
                                                <p className={`text-lg font-bold ${realPropertyGainSerial > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                    {realPropertyGainSerial > 0 ? '+' : ''}{formatCurrency(realPropertyGainSerial)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-sm text-gray-600">Total investering</p>
                                            <p className="text-lg font-bold text-gray-800">{formatCurrency(totalPaidIn)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl">→</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-600">Boligverdi etter {loanTerm} år</p>
                                            <p className="text-lg font-bold text-green-700">{formatCurrency(futurePropertyValue)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl">=</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-600">Gevinst/tap</p>
                                            <p className={`text-xl font-bold ${realPropertyGain > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                {realPropertyGain > 0 ? '+' : ''}{formatCurrency(realPropertyGain)}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>


                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white p-6 rounded-xl shadow-lg">
                                <h3 className="text-xl font-semibold text-gray-700 mb-4">Lånebalanse over tid (Totalt)</h3>
                                <Line data={amortizationChartData} options={{ responsive: true, plugins: { legend: { display: false }}}} />
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-lg">
                                <h3 className="text-xl font-semibold text-gray-700 mb-4">Månedlig Betalingsfordeling (Totalt, 1. mnd)</h3>
                                
                                {/* Principal vs Interest bar */}
                                <div className="mb-4">
                                    <p className="text-sm text-gray-600 mb-2">Avdrag vs Renter (første betaling)</p>
                                    <div className="w-full bg-gray-200 rounded-full h-8 flex overflow-hidden">
                                        <div 
                                            className="bg-green-500 flex items-center justify-center text-white text-xs font-semibold"
                                            style={{ width: `${principalPercentage}%` }}
                                        >
                                            Avdrag {principalPercentage}%
                                        </div>
                                        <div 
                                            className="bg-red-500 flex items-center justify-center text-white text-xs font-semibold"
                                            style={{ width: `${interestPercentage}%` }}
                                        >
                                            Renter {interestPercentage}%
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-600 mt-1">
                                        <span>Avdrag: {formatCurrency(firstPaymentPrincipal)}</span>
                                        <span>Renter: {formatCurrency(firstPaymentInterest)}</span>
                                    </div>
                                </div>
                                
                                <div className="h-64 flex items-center justify-center">
                                    <Pie data={paymentBreakdownChartData} options={{ 
                                        responsive: true, 
                                        maintainAspectRatio: false,
                                        plugins: {
                                            tooltip: {
                                                callbacks: {
                                                    label: function(context) {
                                                        const label = context.label || '';
                                                        const value = formatCurrency(context.parsed);
                                                        return `${label}: ${value}`;
                                                    }
                                                }
                                            }
                                        }
                                    }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper component for input sliders with both slider and number input
const InputSlider = ({ label, value, onChange, min, max, step, format }) => {
    const handleNumberChange = (e) => {
        const inputValue = e.target.value;
        // Tillat tom streng eller tall
        if (inputValue === '') {
            onChange({ target: { value: 0 } });
        } else {
            const newValue = Number(inputValue);
            if (!isNaN(newValue)) {
                // Fjern min/max validering under skriving, la brukeren skrive fritt
                onChange({ target: { value: newValue } });
            }
        }
    };
    
    const handleBlur = (e) => {
        // Valider og korriger ved blur (når feltet mister fokus)
        const newValue = Number(e.target.value);
        if (!isNaN(newValue)) {
            const clampedValue = Math.min(Math.max(newValue, min), max);
            if (clampedValue !== newValue) {
                onChange({ target: { value: clampedValue } });
            }
        }
    };

    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <div className="flex items-center space-x-4">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={onChange}
                    className="w-full h-3 sm:h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer touch-manipulation"
                    aria-label={label}
                />
                <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={handleNumberChange}
                    onBlur={handleBlur}
                    onFocus={(e) => e.target.select()}
                    className="w-32 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
    );
};

// Helper component for tooltips
const HelpTooltip = ({ text, children }) => (
    <span className="relative inline-flex items-center group">
        {children}
        <svg className="w-4 h-4 ml-1 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-sm text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-10">
            {text}
        </span>
    </span>
);

// Helper component for summary boxes
const SummaryBox = ({ label, value, format, color = 'text-gray-800', isLarge = false, tooltip }) => (
    <div className="bg-gray-100 p-3 rounded-lg mt-2">
        <p className="text-sm text-gray-600">
            {tooltip ? <HelpTooltip text={tooltip}>{label}</HelpTooltip> : label}
        </p>
        <p className={`font-bold ${isLarge ? 'text-2xl' : 'text-xl'} ${color}`}>
            {format === 'currency' ? formatCurrency(value) : value}
        </p>
    </div>
);

// Currency formatting utility for Norwegian Krone (NOK)
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', minimumFractionDigits: 0, maximumFractionDigits: 0, }).format(amount || 0);
};

export default App;