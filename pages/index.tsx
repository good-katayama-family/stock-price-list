import {
  Box,
  Button,
  Center,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  StackDivider,
  Text,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  FormErrorMessage,
  PinInput,
  PinInputField,
} from '@chakra-ui/react';
import Head from 'next/head';
import {
  type FC,
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type TStock = {
  stockPrice: number;
  dividend: number;
};

type TCompany = {
  brand: string;
  desiredYield: number; // 希望配当金
  stockCode: string; // 株コード
};

type TStockCard = TStock & TCompany;

const STOCK_CODE = '8591';

export default function Home() {
  const [stock, setStock] = useState<TStock | null>(null);
  const [stocks, setStocks] = useState<TStockCard[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState<boolean>(false);

  // const handleFetchStock = async () => {
  //   setIsLoadingStock(true);
  //   const res = await fetch(`/api/stock?code=${STOCK_CODE}`);
  //   const { stockPrice, dividend }: TStock = await res.json();
  //   setStock({ stockPrice, dividend });
  //   setIsLoadingStock(false);
  // };

  const fetchStockAll = async () => {
    // firebaseからデータを取得
    const snapshot = await getDocs(collection(db, 'stocks'));
    const data = snapshot.docs.map((doc) => doc.data() as TStockCard);
    setStocks(data);
  };

  useEffect(() => {
    fetchStockAll();
  }, []);

  return (
    <>
      <Head>
        <title>stock</title>
        <meta name="description" content="stock" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Box minH="100vh">
        {/* <Button onClick={handleFetchStock} isLoading={isLoadingStock}>
          株価を取得
        </Button>
        {stock && (
          <Text>
            株価 : {stock.stockPrice}円 | 配当金 : {stock.dividend}円
          </Text>
        )} */}
        <RegisterModal />
        {stocks !== undefined ? (
          stocks.map((stock) => (
            <StockCard
              key={stock.stockCode}
              brand={stock.brand}
              stockPrice={stock.stockPrice}
              dividend={stock.dividend}
              desiredYield={stock.desiredYield}
              stockCode={stock.stockCode}
              onUpdateData={() => fetchStockAll()}
            />
          ))
        ) : (
          <Text>データがありません</Text>
        )}
      </Box>
    </>
  );
}

type Props = {
  onUpdateData: () => void;
} & TStockCard;

export const StockCard: FC<Props> = ({
  onUpdateData,
  brand,
  stockPrice,
  dividend,
  desiredYield,
  stockCode,
}) => {
  const dividendYield = useMemo(() => {
    return Math.round((dividend / stockPrice) * 100 * 10) / 10;
  }, [dividend, stockPrice]);

  const desiredPrice = useMemo(() => {
    if (desiredYield === 0) {
      return '---';
    }
    const price =
      Math.round(((stockPrice * dividendYield) / desiredYield) * 10) / 10;
    return `${price}円`;
  }, [desiredYield, dividendYield, stockPrice]);

  const yieldColor = dividendYield >= desiredYield ? 'green.100' : 'red.100';
  const yieldText = `利回り : ${dividendYield}% | 希望利回り : ${desiredYield}%`;

  return (
    <Center>
      <Box bgColor={yieldColor} rounded="md" shadow="md" width="80" p="4" m="2">
        <Heading size="md">{brand}</Heading>
        <Stack divider={<StackDivider />} spacing="2" pt="2">
          <Text pt="2" fontSize="sm">
            現在の株価 : {stockPrice}円 | 希望株価 : {desiredPrice}
          </Text>
          <Text pt="2" fontSize="sm">
            {yieldText}
          </Text>
          <Text pt="2" fontSize="sm">
            配当金 : {dividend}円
          </Text>
          <Flex pt="2">
            <Button
              colorScheme={dividendYield >= desiredYield ? 'green' : 'red'}
              variant="outline"
              w="100%"
              mx={1}
            >
              編集
            </Button>
            <Button
              onClick={onUpdateData}
              colorScheme={dividendYield >= desiredYield ? 'green' : 'red'}
              variant="outline"
              loadingText="更新中"
              isLoading={false}
              w="100%"
              mx={1}
            >
              更新
            </Button>
          </Flex>
        </Stack>
      </Box>
    </Center>
  );
};

const RegisterModal: FC = () => {
  const schema = z.object({
    brand: z.string().nonempty('銘柄を入力してください'),
    stockCode: z.string().length(4, { message: '4桁の数値を入力してください' }),
    desiredYield: z
      .number()
      .min(0, { message: '0以上で入力してください' })
      .max(99.9, { message: '100未満で入力してください' }),
  });

  type TSchema = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
  } = useForm<TSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      brand: '',
      stockCode: '',
      desiredYield: 0,
    },
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleFetchStock = useCallback(async (stockCode: string) => {
    setIsLoading(true);
    const res = await fetch(`/api/stock?code=${stockCode}`);
    const { stockPrice, dividend }: TStock = await res.json();
    setIsLoading(false);
    return { stockPrice, dividend };
  }, []);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const initialRef = useRef(null);
  const onSubmit = async (data: TSchema) => {
    const { stockPrice, dividend } = await handleFetchStock(data.stockCode);
    console.log({
      brand: data.brand,
      stockCode: data.stockCode,
      desiredYield: data.desiredYield,
      stockPrice: stockPrice,
      dividend: dividend,
    });
    try {
      await setDoc(doc(db, 'stocks', data.stockCode), {
        brand: data.brand,
        stockCode: data.stockCode,
        desiredYield: data.desiredYield,
        stockPrice: stockPrice,
        dividend: dividend,
      });
    } catch (error) {
      console.log(error);
    }
    onClose();
  };

  useEffect(() => {
    console.log(errors);
  }, [errors]);

  return (
    <>
      <Button onClick={onOpen} colorScheme={'purple'}>
        新規銘柄登録
      </Button>

      <Modal initialFocusRef={initialRef} isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalContent>
            <ModalHeader>新規銘柄登録</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <FormControl id="brand" isInvalid={Boolean(errors.brand)}>
                <FormLabel>銘柄</FormLabel>
                <Input placeholder="トヨタ自動車" {...register('brand')} />
                <FormErrorMessage>
                  {errors.brand && errors.brand?.message}
                </FormErrorMessage>
              </FormControl>

              <FormControl
                mt={4}
                id="stockCode"
                isInvalid={Boolean(errors.stockCode)}
              >
                <FormLabel>銘柄コード</FormLabel>
                <Controller
                  name="stockCode"
                  control={control}
                  render={({ field: { ref, ...rest } }) => (
                    <PinInput otp {...rest}>
                      <PinInputField />
                      <PinInputField />
                      <PinInputField />
                      <PinInputField />
                    </PinInput>
                  )}
                />
                <FormErrorMessage>
                  {errors.stockCode && errors.stockCode?.message}
                </FormErrorMessage>
              </FormControl>

              <FormControl
                mt={4}
                id="desiredYield"
                isInvalid={Boolean(errors.desiredYield)}
              >
                <FormLabel>希望利回り(後で入力でも可)</FormLabel>
                <Controller
                  name="desiredYield"
                  control={control}
                  render={({ field }) => (
                    <NumberInput precision={1} step={0.1}>
                      <NumberInputField placeholder="0.0" {...field} />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  )}
                />
                <FormErrorMessage>
                  {errors.desiredYield && errors.desiredYield?.message}
                </FormErrorMessage>
              </FormControl>
            </ModalBody>

            <ModalFooter>
              <Button
                colorScheme="blue"
                mr={3}
                type="button"
                onClick={handleSubmit(onSubmit)}
                isLoading={isLoading}
                loadingText="登録中"
              >
                登録
              </Button>
              <Button onClick={onClose}>戻る</Button>
            </ModalFooter>
          </ModalContent>
        </form>
      </Modal>
    </>
  );
};
