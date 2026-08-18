#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { buildMetaDescription, countWords, runQuery, sqlString } from './lib/seo_batch_shared.mjs';

const DRY_RUN = process.env.BLOG_HIGH_RISK_REWRITE_DRY_RUN === '1';
const OUTPUT_DIR = process.env.BLOG_HIGH_RISK_REWRITE_OUTPUT_DIR || 'output/audits';

function compact(text) {
  return String(text || '').trim().replace(/\n{3,}/g, '\n\n');
}

function reportLine(value) {
  return String(value || '').replace(/\|/g, '\\|');
}

const REWRITES = {
  '10-cach-tri-mun-pho-bien-nhung-de-sai-lam-gay-hau-qua-nghiem-trong': {
    title: '10 sai lầm tự trị mụn dễ làm tình trạng nặng hơn',
    summary:
      'Nhiều trường hợp mụn nặng lên không phải vì quá khó trị mà vì chăm sóc sai cách. Bài viết chỉ ra 10 sai lầm phổ biến khi tự trị mụn và cách thay bằng lựa chọn an toàn hơn.',
    metaDescription:
      '10 sai lầm tự trị mụn như nặn mụn, chồng treatment, làm khô da quá mức có thể khiến mụn nặng hơn. Xem cách chăm da mụn an toàn hơn.',
    sources: [
      'https://www.aad.org/public/diseases/acne/skin-care/habits-stop',
      'https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment',
      'https://www.mayoclinic.org/diseases-conditions/acne/in-depth/acne-treatments/art-20045814',
      'https://111.wales.nhs.uk/encyclopaedia/a/article/acne',
    ],
    content: compact(`
Mụn trứng cá không chỉ là chuyện “da bẩn” hay “nóng trong người”. Đây là bệnh lý viêm của đơn vị nang lông - tuyến bã, thường kéo dài theo từng đợt và dễ nặng lên nếu chăm sóc sai. Thực tế, nhiều người không thất bại vì thiếu cố gắng mà vì lặp lại những thói quen tưởng là có ích nhưng lại làm hàng rào da yếu đi, tăng viêm hoặc trì hoãn điều trị đúng.

## Điều cần hiểu trước khi tự trị mụn

Điều trị mụn hiệu quả thường cần ít nhất vài tuần đến vài tháng. Những thứ hứa hẹn “xẹp ngay sau một đêm” hiếm khi giải quyết được nguyên nhân thật sự. Các hướng dẫn điều trị mụn hiện nay ưu tiên những hoạt chất có dữ liệu rõ hơn như adapalene, benzoyl peroxide, salicylic acid hoặc azelaic acid, kết hợp chăm sóc da dịu nhẹ và dùng đều.

## 10 sai lầm rất thường gặp

### 1. Chỉ chấm thuốc lên nốt mụn đang thấy

Mụn hình thành trước khi bạn nhìn thấy bằng mắt thường. Nếu chỉ chấm thuốc lên nốt đang viêm, bạn đang xử lý phần ngọn mà bỏ qua vùng da đang có nguy cơ nổi mụn tiếp theo. Với các hoạt chất trị mụn không kê đơn, cách dùng đúng thường là bôi lớp mỏng lên toàn bộ vùng da dễ nổi mụn, không phải chỉ chấm từng nốt.

### 2. Đổi sản phẩm liên tục vì muốn có kết quả nhanh

Da mụn thường cần thời gian để thích nghi với treatment. Việc đổi sản phẩm liên tục sau vài ngày dễ khiến bạn vừa không đánh giá được hiệu quả thật, vừa tăng nguy cơ kích ứng. Một routine quá thay đổi cũng làm việc truy nguyên nguyên nhân kích ứng gần như không thể.

### 3. Tự nặn, cạy, sờ tay lên mặt

Nặn mụn sai thời điểm hoặc sai kỹ thuật có thể đẩy chất viêm vào sâu hơn, làm tăng thâm sau viêm, nguy cơ sẹo và đau kéo dài. Với mụn nốt, mụn nang hoặc nốt nằm sâu, tự nặn gần như luôn là lựa chọn xấu.

### 4. Rửa mặt quá nhiều hoặc chà xát mạnh

Rửa mặt nhiều lần trong ngày, dùng máy rửa mặt ở cường độ cao hoặc scrub hạt thô không làm da “sạch mụn” hơn. Ngược lại, ma sát quá mức khiến da kích ứng và có thể làm mụn bùng lên. Phần lớn trường hợp chỉ cần rửa mặt dịu nhẹ 2 lần mỗi ngày và sau khi đổ mồ hôi nhiều.

### 5. Cố làm khô mụn bằng mọi giá

Cồn, chanh, baking soda, kem đánh răng, thuốc rượu hoặc các hỗn hợp tự pha có thể tạo cảm giác “khô nhanh”, nhưng đó không phải dấu hiệu mụn đang được điều trị đúng. Khô rát quá mức là dấu hiệu hàng rào da bị tổn thương. Khi da bị kích ứng, tình trạng viêm dễ nặng hơn và thâm đỏ cũng kéo dài hơn.

### 6. Chồng quá nhiều hoạt chất mạnh trong cùng một lúc

Retinoid, acid tẩy da chết, benzoyl peroxide, vitamin C nồng độ cao và peel tại nhà đều có thể gây kích ứng nếu phối hợp thiếu kế hoạch. Sai lầm phổ biến là đưa vào cùng lúc nhiều treatment “để mau hết mụn”. Kết quả thường gặp là đỏ rát, bong tróc, châm chích kéo dài và phải ngừng hết sản phẩm.

### 7. Bỏ dưỡng ẩm và chống nắng vì sợ bí da

Da mụn vẫn cần dưỡng ẩm. Nếu routine làm da khô căng nhưng bạn tiếp tục bỏ qua kem dưỡng, da càng dễ kích ứng. Tương tự, chống nắng không làm “đổ dầu nhiều hơn” nếu bạn chọn sản phẩm phù hợp. Bỏ chống nắng khiến vết thâm sau mụn dễ đậm và lâu mờ hơn.

### 8. Tự mua thuốc mạnh hoặc nghe theo review thiếu kiểm chứng

Kháng sinh uống, isotretinoin, peel mạnh hoặc các sản phẩm “bác sĩ khuyên dùng” trên mạng không nên được xem là giải pháp tự dùng. Một sản phẩm hợp với người khác chưa chắc hợp với bạn, nhất là khi kiểu mụn, độ nhạy cảm của da và bệnh nền khác nhau.

### 9. Tin vào mẹo dân gian thay cho điều trị có cơ sở

Nha đam, nghệ, tinh dầu, mật ong, khổ qua hay nhiều nguyên liệu tự nhiên khác có thể được truyền miệng rộng rãi, nhưng dữ liệu lâm sàng thường ít, không đồng đều hoặc chỉ nên xem là hỗ trợ. Nếu dùng chúng để thay cho điều trị chuẩn, bạn có nguy cơ mất thời gian vàng kiểm soát mụn.

### 10. Chờ quá lâu mới đi khám

Nếu mụn đã thành nốt đau, mụn nang, lan rộng ở lưng ngực, để lại sẹo hoặc không cải thiện sau 8 đến 12 tuần chăm sóc đúng, việc tiếp tục tự xoay xở thường không còn hiệu quả. Lúc này nên gặp bác sĩ da liễu để đánh giá loại mụn, mức độ viêm và chỉ định phác đồ phù hợp hơn.

## Routine nền tảng an toàn hơn cho da mụn

- Rửa mặt dịu nhẹ 2 lần mỗi ngày và sau khi đổ mồ hôi nhiều.
- Dùng sản phẩm không gây bít tắc lỗ chân lông.
- Chọn 1 hoạt chất trị mụn chính, bắt đầu từ tần suất thấp rồi tăng dần.
- Dưỡng ẩm đều để giảm khô rát và duy trì hàng rào da.
- Chống nắng phổ rộng hằng ngày.
- Theo dõi da ít nhất 6 đến 8 tuần trước khi kết luận một routine có hiệu quả hay không.

## Khi nào nên đi khám sớm

Bạn nên đi khám sớm nếu có mụn nốt hoặc mụn nang đau, mụn để lại sẹo, da đỏ rát kéo dài vì treatment, mụn bùng phát sau thuốc hoặc mỹ phẩm mới, hoặc đã chăm sóc đúng mà vẫn không cải thiện. Phụ nữ đang mang thai hoặc chuẩn bị mang thai cũng nên hỏi bác sĩ trước khi tự dùng sản phẩm trị mụn.

## Nguồn tham khảo y khoa

- [AAD: 10 skin care habits that can worsen acne](https://www.aad.org/public/diseases/acne/skin-care/habits-stop)
- [AAD: Adult acne treatment dermatologists recommend](https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment)
- [Mayo Clinic: Nonprescription acne treatment](https://www.mayoclinic.org/diseases-conditions/acne/in-depth/acne-treatments/art-20045814)
- [NHS: Acne treatments and self-care](https://111.wales.nhs.uk/encyclopaedia/a/article/acne)
    `),
  },
  'boi-kem-danh-rang-len-mun-co-giup-giam-mun-khong': {
    title: 'Bôi kem đánh răng lên mụn có hiệu quả không?',
    summary:
      'Kem đánh răng không phải thuốc trị mụn. Cảm giác khô nhanh có thể đi kèm đỏ rát, bong tróc và làm hàng rào da yếu đi. Bài viết giải thích vì sao không nên dùng mẹo này.',
    metaDescription:
      'Bôi kem đánh răng lên mụn không được khuyến nghị vì dễ gây kích ứng da. Xem vì sao mẹo này không hiệu quả và đâu là lựa chọn xử lý mụn an toàn hơn.',
    sources: [
      'https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment',
      'https://111.wales.nhs.uk/encyclopaedia/a/article/acne',
      'https://www.mayoclinic.org/diseases-conditions/acne/in-depth/acne-treatments/art-20045814',
      'https://www.aad.org/news/how-to-treat-painful-pimple-home',
    ],
    content: compact(`
Nếu cần câu trả lời ngắn gọn: **không nên bôi kem đánh răng lên mụn**. Đây không phải là phương pháp điều trị mụn được bác sĩ da liễu khuyến nghị. Cảm giác khô nhanh sau khi bôi kem đánh răng không đồng nghĩa với việc nốt mụn đang lành đúng cách.

## Vì sao mẹo này vẫn được truyền miệng?

Kem đánh răng có thể tạo cảm giác mát, khô hoặc châm chích nên nhiều người tưởng rằng nó đang “làm xẹp mụn”. Một số loại còn chứa peroxide, baking soda hoặc chất làm sạch nên khiến bề mặt nốt mụn tạm thời khô hơn. Tuy nhiên, hiệu ứng này chủ yếu là kích ứng bề mặt chứ không phải điều trị đúng cơ chế của mụn.

## Vì sao kem đánh răng không phù hợp cho da mụn?

Kem đánh răng được thiết kế cho răng và niêm mạc miệng, không phải cho da mặt. Sản phẩm thường chứa hương liệu, chất tạo bọt, chất mài mòn hoặc chất làm trắng. Các thành phần này không giúp kiểm soát mụn theo cách đã được chứng minh, nhưng có thể làm da đỏ rát và bong tróc.

Theo bác sĩ da liễu của AAD, kem đánh răng không phải lựa chọn trị mụn tại nhà; thay vào đó nên dùng những hoạt chất đã có dữ liệu rõ hơn như adapalene, benzoyl peroxide hoặc salicylic acid.

## Những rủi ro thường gặp khi bôi kem đánh răng lên mụn

### Kích ứng và bỏng rát

Da vùng mụn vốn đang viêm. Thêm một chất dễ gây kích ứng lên trên có thể làm đỏ rát rõ hơn, nhất là ở người có da nhạy cảm hoặc đang dùng treatment khác.

### Khô quá mức và hỏng hàng rào da

Khi da bị khô căng, bong vảy hoặc châm chích kéo dài, hàng rào bảo vệ da đang bị tổn thương. Điều này không giúp mụn hết nhanh hơn mà còn làm da dễ phản ứng với các sản phẩm khác.

### Tăng thâm sau viêm

Một nốt mụn bị kích ứng mạnh có thể để lại vết đỏ hoặc thâm lâu hơn bình thường. Đây là điều nhiều người không để ý khi chọn mẹo “cấp tốc”.

### Che lấp vấn đề thật sự

Nếu bạn liên tục lặp lại mẹo này, bạn có thể trì hoãn việc xây dựng routine đúng hoặc đi khám khi mụn đã ở mức vừa đến nặng.

## Nếu muốn xử lý nhanh một nốt mụn, nên làm gì?

- Với mụn viêm nông, có thể dùng sản phẩm chấm mụn chứa benzoyl peroxide hoặc salicylic acid nếu da chịu được.
- Với nốt mụn đau nằm sâu, có thể chườm ấm sạch trong thời gian ngắn để hỗ trợ nốt mụn trồi lên bề mặt hơn, rồi theo dõi tiếp.
- Miếng dán hydrocolloid có thể giúp hạn chế sờ tay vào mụn và bảo vệ vùng da đang viêm.
- Không nên nặn, cạy hoặc chà xát mạnh.

## Routine nền tảng vẫn quan trọng hơn “mẹo chấm mụn”

Muốn mụn ổn định lâu dài, bạn cần một routine đơn giản và nhất quán: rửa mặt dịu nhẹ, dưỡng ẩm không gây bít tắc, chống nắng và chọn hoạt chất trị mụn phù hợp. Các sản phẩm điều trị thường cần vài tuần mới cho kết quả rõ ràng; vì vậy đừng đánh đổi hàng rào da chỉ để lấy cảm giác “khô nhanh”.

## Khi nào nên đi khám

Bạn nên đi khám nếu mụn đau nhiều, nổi thành cục sâu, lan rộng, để lại sẹo, hoặc đã thử routine không kê đơn vài tuần mà không cải thiện. Nếu đang mang thai hoặc chuẩn bị mang thai, nên hỏi bác sĩ trước khi tự dùng sản phẩm trị mụn.

## Nguồn tham khảo y khoa

- [AAD: Adult acne treatment dermatologists recommend](https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment)
- [AAD: How to treat a deep, painful pimple at home](https://www.aad.org/news/how-to-treat-painful-pimple-home)
- [NHS: Acne and toothpaste](https://111.wales.nhs.uk/encyclopaedia/a/article/acne)
- [Mayo Clinic: Nonprescription acne treatment](https://www.mayoclinic.org/diseases-conditions/acne/in-depth/acne-treatments/art-20045814)
    `),
  },
  'cay-co-sua-tri-mun-trung-ca-nhu-the-nao-giai-dap-tu-bac-si': {
    title: 'Cỏ sữa có trị mụn trứng cá không? Điều cần biết trước khi thử',
    summary:
      'Cỏ sữa có mặt trong nhiều mẹo dân gian trị mụn, nhưng dữ liệu lâm sàng cho mụn trứng cá hiện vẫn rất hạn chế. Bài viết giúp bạn nhìn rõ lợi ích tiềm năng, giới hạn và rủi ro khi tự dùng.',
    metaDescription:
      'Cỏ sữa chưa có đủ bằng chứng lâm sàng để xem là phương pháp trị mụn chuẩn. Xem giới hạn của mẹo dân gian này và các lựa chọn điều trị có căn cứ hơn.',
    sources: [
      'https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment',
      'https://www.mayoclinic.org/diseases-conditions/acne/in-depth/acne-treatments/art-20045814',
      'https://www.nccih.nih.gov/health/how-safe-is-this-product-or-practice',
    ],
    content: compact(`
Cỏ sữa là một nguyên liệu dân gian được nhắc đến khá nhiều trong các bài thuốc truyền thống. Tuy nhiên, khi chuyển sang câu hỏi rất cụ thể là **cỏ sữa có điều trị được mụn trứng cá hay không**, câu trả lời cần thận trọng hơn nhiều. Ở thời điểm hiện tại, chưa có đủ bằng chứng lâm sàng chất lượng cao để coi cỏ sữa là một phương pháp trị mụn chuẩn.

## Vì sao cỏ sữa được nhiều người quan tâm?

Trong y học cổ truyền, cỏ sữa thường được nhắc đến với vai trò hỗ trợ cho một số vấn đề da liễu. Ở mức nghiên cứu tiền lâm sàng, một số thành phần thực vật có thể cho thấy hoạt tính kháng khuẩn hoặc chống viêm trong phòng thí nghiệm. Đây là lý do nhiều người kỳ vọng cỏ sữa có thể giúp da mụn.

Vấn đề là dữ liệu phòng thí nghiệm không đủ để kết luận hiệu quả điều trị trên da người thật ngoài đời sống. Mụn trứng cá không chỉ liên quan đến vi khuẩn mà còn liên quan đến bít tắc nang lông, dầu thừa, đáp ứng viêm, nội tiết và cả thói quen chăm sóc da.

## Vì sao chưa thể xem cỏ sữa là phương pháp trị mụn chuẩn?

Các hướng dẫn điều trị mụn hiện hành của da liễu không xếp cỏ sữa vào nhóm lựa chọn điều trị tiêu chuẩn. Những hoạt chất được khuyến nghị nhiều hơn là adapalene, benzoyl peroxide, salicylic acid, azelaic acid hoặc các thuốc kê đơn khi mụn nặng hơn.

Điều này không có nghĩa cỏ sữa chắc chắn vô ích; nó chỉ có nghĩa rằng **bằng chứng hiện tại chưa đủ mạnh** để khuyên người bệnh dùng thay cho các phương pháp đã được nghiên cứu rõ hơn.

## Rủi ro khi tự dùng cỏ sữa tại nhà

### Kích ứng da do nguyên liệu thô

Lá, thân hoặc nhựa cây thoa trực tiếp lên da có thể gây châm chích, đỏ rát hoặc viêm kích ứng ở một số người, nhất là khi da đang có mụn viêm hoặc hàng rào da đang yếu.

### Nhiễm bẩn và không kiểm soát được liều lượng

Nguyên liệu hái ngoài vườn hoặc mua trôi nổi khó kiểm soát độ sạch, nồng độ hoạt chất và nguy cơ tồn dư chất bẩn. Một hỗn hợp tự pha không có chuẩn nồng độ ổn định cũng khiến việc đánh giá hiệu quả và độ an toàn trở nên rất khó.

### Trì hoãn điều trị đúng

Rủi ro lớn nhất không phải lúc nào cũng là kích ứng. Nhiều người mất hàng tuần đến hàng tháng theo các mẹo dân gian, trong khi mụn tiếp tục viêm, lan rộng hoặc bắt đầu để sẹo.

## Nếu bạn vẫn muốn thử, nên giữ giới hạn nào?

- Không bôi nhựa hoặc dịch chiết tự pha lên vùng da đang trợt xước, rỉ dịch hoặc có mụn nang đau.
- Không trộn với chanh, cồn, thuốc rượu hay các nguyên liệu dễ kích ứng khác.
- Thử trên vùng da nhỏ trước, theo dõi ít nhất 24 đến 48 giờ.
- Ngừng ngay nếu có đỏ rát, ngứa, nóng da hoặc nổi thêm sẩn viêm.
- Không dùng cỏ sữa để thay thế hoàn toàn routine trị mụn có cơ sở.

## Lựa chọn đáng tin hơn cho da mụn

Nếu mụn mức độ nhẹ, bạn có thể bắt đầu bằng routine dịu nhẹ, dưỡng ẩm phù hợp, chống nắng và một hoạt chất trị mụn không kê đơn. Nếu mụn viêm nhiều, đau, kéo dài hoặc để lại sẹo, bác sĩ da liễu có thể cần chỉ định thuốc bôi, thuốc uống hoặc thủ thuật phù hợp hơn.

## Khi nào nên bỏ mẹo dân gian và đi khám

Bạn nên đi khám nếu mụn không cải thiện sau 8 đến 12 tuần, có mụn nốt hoặc mụn nang, thâm sẹo tăng dần, hoặc da trở nên đỏ rát sau khi tự đắp lá, bôi nhựa, bôi hỗn hợp tự pha. Với da mụn, “tự nhiên” không đồng nghĩa với “an toàn”.

## Nguồn tham khảo y khoa

- [AAD: Adult acne treatment dermatologists recommend](https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment)
- [Mayo Clinic: Nonprescription acne treatment](https://www.mayoclinic.org/diseases-conditions/acne/in-depth/acne-treatments/art-20045814)
- [NCCIH: How Safe Is This Product or Practice?](https://www.nccih.nih.gov/health/how-safe-is-this-product-or-practice)
    `),
  },
  'goi-y-11-cach-dung-nha-dam-tri-mun-don-gian-tai-nha': {
    title: 'Nha đam có giúp da mụn không? Cách nhìn thực tế hơn',
    summary:
      'Nha đam có thể làm dịu da ở một số trường hợp, nhưng bằng chứng hỗ trợ trị mụn vẫn còn hạn chế. Bài viết giúp bạn hiểu nha đam có thể hỗ trợ đến đâu và khi nào nên thận trọng.',
    metaDescription:
      'Nha đam có thể hỗ trợ làm dịu da nhưng chưa phải phương pháp trị mụn chuẩn. Xem giới hạn bằng chứng, rủi ro kích ứng và cách dùng an toàn hơn.',
    sources: [
      'https://www.nccih.nih.gov/health/aloe-vera',
      'https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment',
      'https://www.mayoclinic.org/diseases-conditions/acne/in-depth/acne-treatments/art-20045814',
    ],
    content: compact(`
Nha đam là nguyên liệu rất quen thuộc trong chăm sóc da. Nhiều người dùng nha đam vì cảm giác mát, dịu và hy vọng nó có thể giúp giảm sưng viêm của mụn. Cách hiểu hợp lý hơn là: **nha đam có thể đóng vai trò hỗ trợ ở một số người, nhưng không nên được xem là giải pháp chính để trị mụn**.

## Nha đam có thể giúp ở mức nào?

Theo NCCIH, có một lượng nghiên cứu nhỏ cho thấy gel nha đam bôi ngoài da, khi kết hợp với phương pháp điều trị khác, có thể giúp cải thiện mụn. Điểm quan trọng nằm ở hai chữ “kết hợp”. Bằng chứng hiện có không đủ để kết luận chỉ dùng nha đam đơn độc là đã kiểm soát mụn tốt.

Nói cách khác, nha đam có thể hỗ trợ làm dịu da, nhưng chưa phải hoạt chất nền tảng trong các hướng dẫn điều trị mụn chính thống.

## Vì sao nhiều người thấy nha đam “hợp” với da mụn?

Gel nha đam chứa nhiều nước, tạo cảm giác mát và dễ chịu trên vùng da đang rát hoặc khô. Với một số người, điều này giúp da bớt khó chịu trong giai đoạn đang dùng treatment. Nếu dùng đúng loại sản phẩm và da không kích ứng, nha đam có thể đóng vai trò như một bước làm dịu bổ sung.

## Những giới hạn cần biết

### Không thay thế được điều trị chuẩn

Mụn trứng cá hình thành do nhiều cơ chế cùng lúc: bít tắc lỗ chân lông, tăng tiết bã nhờn, đáp ứng viêm và vi khuẩn. Nha đam không giải quyết được đầy đủ những cơ chế này như các hoạt chất trị mụn đã được nghiên cứu rõ hơn.

### Không phải ai cũng hợp

NCCIH ghi nhận nha đam bôi ngoài da nhìn chung được dung nạp khá tốt, nhưng vẫn có báo cáo về bỏng rát, ngứa, phát ban và chàm. Da mụn đang kích ứng hoặc đã suy hàng rào da có thể phản ứng mạnh hơn.

### Nha đam tươi không giống sản phẩm chăm sóc da đã chuẩn hóa

Gel lấy trực tiếp từ lá, phần nhựa vàng, hỗn hợp tự xay hoặc công thức trộn với chanh, quế, tinh dầu không có độ ổn định và độ an toàn như sản phẩm được bào chế sẵn. Đây là điểm nhiều người bỏ qua khi làm mặt nạ tại nhà.

## Những cách dùng tại nhà nên tránh

- Đắp nha đam tươi qua đêm trên da đang viêm.
- Trộn nha đam với chanh, quế, tinh dầu hoặc các nguyên liệu dễ gây kích ứng.
- Bôi lên vùng da đang trầy xước, chảy dịch hoặc mới nặn mụn.
- Uống nha đam hoặc dùng phần nhựa vàng với kỳ vọng trị mụn từ bên trong.

## Nếu muốn dùng nha đam hỗ trợ, nên làm thế nào?

- Ưu tiên sản phẩm gel đơn giản, ít hương liệu, công bố thành phần rõ ràng.
- Thử trên một vùng da nhỏ trước.
- Xem nha đam như bước làm dịu bổ sung, không phải treatment chính.
- Nếu đang dùng adapalene, benzoyl peroxide hoặc acid trị mụn, chỉ nên dùng nha đam khi da thực sự cần làm dịu và không bị kích ứng thêm.

## Những lựa chọn có căn cứ hơn cho da mụn

Nếu mục tiêu là kiểm soát mụn chứ không chỉ làm dịu tạm thời, các lựa chọn có cơ sở hơn vẫn là hoạt chất trị mụn không kê đơn hoặc kê đơn phù hợp với từng kiểu mụn. Routine nền tảng gồm rửa mặt dịu nhẹ, dưỡng ẩm không gây bít tắc và chống nắng hằng ngày vẫn quan trọng hơn một mặt nạ tự làm.

## Khi nào nên đi khám

Hãy đi khám nếu mụn viêm kéo dài, có nốt đau sâu, để lại sẹo, hoặc da trở nên đỏ rát sau khi đắp nha đam hay các mặt nạ tự chế. Nếu bạn thấy một nguyên liệu “lành tính” mà da vẫn châm chích, đó là tín hiệu nên dừng lại thay vì cố chịu.

## Nguồn tham khảo y khoa

- [NCCIH: Aloe vera - usefulness and safety](https://www.nccih.nih.gov/health/aloe-vera)
- [AAD: Adult acne treatment dermatologists recommend](https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment)
- [Mayo Clinic: Nonprescription acne treatment](https://www.mayoclinic.org/diseases-conditions/acne/in-depth/acne-treatments/art-20045814)
    `),
  },
  'tri-mun-bang-nghe-tuoi-co-hieu-qua-khong-cac-luu-y-khi-thuc-hien': {
    title: 'Bôi nghệ tươi lên mụn có hiệu quả không? Điều cần lưu ý',
    summary:
      'Nghệ là nguyên liệu quen thuộc trong chăm sóc da, nhưng dữ liệu về hiệu quả trị mụn vẫn còn hạn chế. Bài viết giúp bạn hiểu rõ nghệ có thể hỗ trợ đến đâu và những rủi ro dễ gặp khi bôi trực tiếp.',
    metaDescription:
      'Bôi nghệ tươi lên mụn chưa có đủ bằng chứng để xem là cách trị mụn chuẩn. Xem lợi ích tiềm năng, rủi ro kích ứng và cách lựa chọn an toàn hơn.',
    sources: [
      'https://www.nccih.nih.gov/health/turmeric',
      'https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment',
      'https://111.wales.nhs.uk/encyclopaedia/a/article/acne',
    ],
    content: compact(`
Nghệ được dùng rất nhiều trong các mẹo chăm sóc da vì gắn với hình ảnh “chống viêm” và “mờ thâm”. Tuy nhiên, khi nói riêng về mụn trứng cá, cần tách bạch giữa kỳ vọng dân gian và bằng chứng lâm sàng. **Nghệ có một số đặc tính đáng quan tâm về mặt sinh học, nhưng chưa có đủ dữ liệu để xem bôi nghệ tươi là phương pháp trị mụn chuẩn.**

## Vì sao nghệ thường được gắn với da mụn?

Hoạt chất được nhắc đến nhiều nhất trong nghệ là curcumin. Trong nghiên cứu cơ bản, curcumin có liên quan đến đặc tính chống oxy hóa và chống viêm. Chính điều này khiến nhiều người nghĩ rằng bôi nghệ tươi lên mụn sẽ giúp xẹp nhanh và giảm thâm.

Vấn đề là dữ liệu thực hành trên da người thật vẫn chưa đủ mạnh để đưa nghệ vào nhóm điều trị mụn chuẩn như retinoid, benzoyl peroxide hoặc azelaic acid.

## Điều khoa học hiện có cho thấy gì?

Theo NCCIH, chưa có đủ bằng chứng để kết luận turmeric hoặc curcumin có lợi rõ ràng cho các mục đích sức khỏe nói chung. Với da, dữ liệu càng hạn chế hơn. Điều này không có nghĩa nghệ chắc chắn vô tác dụng; nó có nghĩa rằng bằng chứng hiện tại chưa đủ để khuyến nghị dùng thay cho điều trị chuẩn.

## Những rủi ro dễ bị xem nhẹ khi bôi nghệ tươi

### Kích ứng da

NCCIH ghi nhận curcumin bôi ngoài da có thể gây nổi mề đay hoặc ngứa. Với da mụn đang viêm, điều này càng đáng lưu ý hơn.

### Làm bẩn da và che khuất dấu hiệu kích ứng

Màu vàng của nghệ có thể bám lên da, móng, khăn hoặc gối. Khi vùng da đổi màu do nghệ, nhiều người khó nhận ra mức độ đỏ rát hoặc viêm thật sự bên dưới.

### Trộn sai nguyên liệu

Nghệ thường bị trộn thêm chanh, mật ong, sữa chua, cám gạo hoặc tinh dầu trong các công thức tại nhà. Một số hỗn hợp này có thể làm tăng kích ứng, nhất là trên da đang có mụn viêm hoặc đang dùng treatment.

### Trì hoãn điều trị hiệu quả hơn

Nếu bạn dành nhiều tuần chỉ để thử các mặt nạ từ nghệ trong khi mụn tiếp tục viêm, nguy cơ để lại thâm và sẹo sẽ tăng lên.

## Nếu vẫn muốn dùng nghệ, nên giữ giới hạn nào?

- Không bôi nghệ tươi lên vùng da đang trợt xước, mới nặn mụn hoặc có mụn nang đau.
- Không dùng nghệ như “thuốc chấm mụn” qua đêm.
- Không trộn với chanh hoặc các thành phần gây xót.
- Thử trên vùng da nhỏ trước khi dùng rộng hơn.
- Nếu muốn tận dụng nghệ, an toàn hơn là xem nó như một thành phần trong sản phẩm chăm sóc da đã được bào chế rõ ràng, thay vì dùng củ nghệ tươi giã trực tiếp.

## Điều trị mụn nên ưu tiên gì hơn?

Nếu mục tiêu là giảm mụn thật sự, bạn nên ưu tiên routine dịu nhẹ và treatment có cơ sở hơn. Với mụn đầu đen, mụn đầu trắng hoặc mụn viêm nhẹ, các hoạt chất không kê đơn có thể là điểm bắt đầu hợp lý. Với mụn nốt, mụn nang, mụn để lại sẹo hoặc mụn kéo dài, bác sĩ da liễu cần tham gia sớm hơn.

## Khi nào cần đi khám

Nên đi khám nếu mụn đau, lan rộng, tái đi tái lại, để lại sẹo hoặc da trở nên đỏ rát sau khi tự bôi nghệ. Nếu bạn đang mang thai hoặc đang cân nhắc dùng sản phẩm bổ sung curcumin, cũng nên hỏi bác sĩ trước vì mức độ an toàn không phải lúc nào cũng rõ ràng.

## Nguồn tham khảo y khoa

- [NCCIH: Turmeric - usefulness and safety](https://www.nccih.nih.gov/health/turmeric)
- [AAD: Adult acne treatment dermatologists recommend](https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment)
- [NHS: Acne treatments and self-care](https://111.wales.nhs.uk/encyclopaedia/a/article/acne)
    `),
  },
  'kho-qua-co-tri-mun-khong-luu-y-khi-tri-mun-bang-kho-qua': {
    title: 'Khổ qua có giúp giảm mụn không? Điều cần biết trước khi thử',
    summary:
      'Khổ qua là thực phẩm lành mạnh trong bữa ăn, nhưng không nên xem là phương pháp trị mụn có bằng chứng rõ. Bài viết giúp bạn phân biệt vai trò của thực phẩm hỗ trợ và điều trị mụn thật sự.',
    metaDescription:
      'Khổ qua không phải phương pháp trị mụn chuẩn và chưa có dữ liệu lâm sàng đủ mạnh. Xem giới hạn của mẹo này và các lựa chọn trị mụn đáng tin hơn.',
    sources: [
      'https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment',
      'https://www.mayoclinic.org/diseases-conditions/acne/in-depth/acne-treatments/art-20045814',
      'https://111.wales.nhs.uk/encyclopaedia/a/article/acne',
    ],
    content: compact(`
Khổ qua hay mướp đắng là thực phẩm quen thuộc và hoàn toàn có thể là một phần của chế độ ăn lành mạnh. Tuy nhiên, từ việc “ăn tốt cho sức khỏe” đến kết luận “trị được mụn” là hai chuyện rất khác nhau. Với mụn trứng cá, **khổ qua không phải là phương pháp điều trị chuẩn và chưa có dữ liệu lâm sàng đủ mạnh để xem đây là cách kiểm soát mụn đáng tin cậy**.

## Vì sao khổ qua thường được gắn với mẹo trị mụn?

Khổ qua chứa nhiều vi chất và thường được gán với hình ảnh “thanh nhiệt”, “mát gan” hoặc “giải độc”. Đây là cách lý giải quen thuộc trong các mẹo dân gian. Một số nghiên cứu cơ bản có thể cho thấy vài thành phần thực vật có hoạt tính sinh học, nhưng điều đó không tự động chứng minh hiệu quả trị mụn trên da người.

## Mụn trứng cá không được quyết định bởi một nguyên liệu

Mụn liên quan đến bít tắc nang lông, tăng tiết bã, phản ứng viêm, vi khuẩn và yếu tố nội tiết. Vì vậy, hiếm có chuyện một loại nước ép hoặc một mặt nạ tự làm có thể tác động đủ mạnh lên toàn bộ cơ chế này. Các hướng dẫn da liễu hiện hành vẫn ưu tiên hoạt chất trị mụn đã được nghiên cứu rõ hơn.

## Những giới hạn của việc dùng khổ qua để trị mụn

### Không có chuẩn liều và cách dùng

Mặt nạ khổ qua, nước ép khổ qua hay hỗn hợp trộn với mật ong đều là các công thức truyền miệng, không có chuẩn nồng độ rõ ràng. Cùng một công thức nhưng độ an toàn và mức kích ứng có thể khác nhau rất nhiều giữa từng người.

### Không thay thế được treatment có bằng chứng

Nếu bạn đang có mụn viêm, mụn nang hoặc mụn để lại sẹo, việc tiếp tục dựa vào mặt nạ hoặc nước ép khổ qua có thể chỉ kéo dài thời gian viêm mà không giải quyết được gốc vấn đề.

### Có thể gây kích ứng ở da nhạy cảm

Da mụn thường vốn đã nhạy cảm hơn bình thường. Bất kỳ hỗn hợp tự xay, tự đắp nào cũng có nguy cơ gây xót, đỏ hoặc làm da phản ứng, đặc biệt khi bạn đang dùng thêm acid hoặc retinoid.

## Nếu vẫn muốn thử, nên nhìn nó như thế nào?

- Xem khổ qua trước hết là một loại thực phẩm, không phải thuốc trị mụn.
- Không đắp khổ qua sống lên vùng da đang viêm mạnh, có vết thương hở hoặc mới nặn mụn.
- Không kỳ vọng nước ép khổ qua sẽ “đẩy độc” hay làm mụn biến mất nhanh.
- Nếu một hỗn hợp tự làm khiến da rát hoặc ngứa, hãy ngừng ngay.

## Điều gì đáng tin hơn cho da mụn?

Routine đơn giản, đều đặn và ít kích ứng luôn đáng tin hơn những mẹo quá phức tạp. Hãy bắt đầu từ rửa mặt dịu nhẹ, dưỡng ẩm, chống nắng và một treatment phù hợp. Nếu sau 8 đến 12 tuần mụn vẫn kéo dài, hoặc ngay từ đầu đã có mụn nốt, mụn nang, đau nhiều hay sẹo, bác sĩ da liễu nên là người đánh giá tiếp theo.

## Vai trò hợp lý của chế độ ăn

Ăn uống lành mạnh có lợi cho sức khỏe tổng thể và có thể giúp bạn duy trì thói quen sống tốt hơn, nhưng không nên quy toàn bộ việc nổi mụn cho một món ăn hay kỳ vọng một loại rau quả sẽ thay thế điều trị. Khi nói về mụn, cách tiếp cận bền hơn vẫn là điều trị đúng cơ chế và theo dõi đáp ứng thực tế của da.

## Khi nào nên đi khám

Bạn nên đi khám nếu mụn viêm nhiều, kéo dài, để lại sẹo, hoặc da xấu đi sau khi tự đắp các nguyên liệu thiên nhiên. Với mụn, trì hoãn điều trị đúng thường gây tốn thời gian hơn rất nhiều so với việc khám sớm.

## Nguồn tham khảo y khoa

- [AAD: Adult acne treatment dermatologists recommend](https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment)
- [Mayo Clinic: Nonprescription acne treatment](https://www.mayoclinic.org/diseases-conditions/acne/in-depth/acne-treatments/art-20045814)
- [NHS: Acne treatments and self-care](https://111.wales.nhs.uk/encyclopaedia/a/article/acne)
    `),
  },
};

function validate(slug, record) {
  if (record.title.length < 35 || record.title.length > 78) {
    throw new Error(`${slug}: title length ${record.title.length} outside 35-78`);
  }
  if (record.summary.length < 110 || record.summary.length > 220) {
    throw new Error(`${slug}: summary length ${record.summary.length} outside 110-220`);
  }
  const meta = record.metaDescription || buildMetaDescription(record.summary, record.content, record.title);
  if (meta.length < 120 || meta.length > 170) {
    throw new Error(`${slug}: meta length ${meta.length} outside 120-170`);
  }
  const words = countWords(record.content);
  if (words < 350) {
    throw new Error(`${slug}: content too thin (${words} words)`);
  }
}

async function main() {
  const slugs = Object.keys(REWRITES);
  const slugSql = slugs.map(sqlString).join(', ');
  const existing = await runQuery(`
    select slug, title, summary, meta_description, content
    from public.blog_posts
    where slug in (${slugSql})
    order by slug asc;
  `);

  if (existing.length !== slugs.length) {
    const found = new Set(existing.map((row) => row.slug));
    const missing = slugs.filter((slug) => !found.has(slug));
    throw new Error(`Missing blog posts: ${missing.join(', ')}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const backupPath = path.join(OUTPUT_DIR, `blog-high-risk-rewrite-backup-${timestamp}.json`);
  await fs.writeFile(backupPath, JSON.stringify(existing, null, 2), 'utf8');

  const results = [];
  for (const post of existing) {
    const rewrite = REWRITES[post.slug];
    validate(post.slug, rewrite);

    const payload = {
      title: rewrite.title,
      summary: rewrite.summary,
      meta_description: rewrite.metaDescription || buildMetaDescription(rewrite.summary, rewrite.content, rewrite.title),
      content: rewrite.content,
    };

    if (!DRY_RUN) {
      await runQuery(`
        update public.blog_posts
        set
          title = ${sqlString(payload.title)},
          summary = ${sqlString(payload.summary)},
          meta_description = ${sqlString(payload.meta_description)},
          content = ${sqlString(payload.content)},
          updated_at = now()
        where slug = ${sqlString(post.slug)};
      `);
    }

    results.push({
      slug: post.slug,
      title: payload.title,
      summaryLength: payload.summary.length,
      metaLength: payload.meta_description.length,
      wordCount: countWords(payload.content),
      sources: rewrite.sources,
    });
  }

  const reportLines = [];
  reportLines.push('# High-Risk Acne Rewrite Report');
  reportLines.push('');
  reportLines.push(`- Generated at: \`${new Date().toISOString()}\``);
  reportLines.push(`- Dry run: **${DRY_RUN ? 'yes' : 'no'}**`);
  reportLines.push(`- Rewritten posts: **${results.length}**`);
  reportLines.push(`- Backup: \`${backupPath}\``);
  reportLines.push('');
  reportLines.push('| slug | title | summary_len | meta_len | words |');
  reportLines.push('| --- | --- | ---: | ---: | ---: |');
  for (const item of results) {
    reportLines.push(`| ${item.slug} | ${reportLine(item.title)} | ${item.summaryLength} | ${item.metaLength} | ${item.wordCount} |`);
  }
  reportLines.push('');
  reportLines.push('## Sources');
  reportLines.push('');
  for (const item of results) {
    reportLines.push(`### ${item.slug}`);
    for (const source of item.sources) {
      reportLines.push(`- ${source}`);
    }
    reportLines.push('');
  }

  const reportPath = path.join(OUTPUT_DIR, `blog-high-risk-rewrite-report-${timestamp}.md`);
  await fs.writeFile(reportPath, `${reportLines.join('\n')}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        rewritten: results.length,
        backupPath,
        reportPath,
        sample: results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
